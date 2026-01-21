import dgram from "node:dgram";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import pty from "node-pty";
import { encodeFrame, createFrameDecoder } from "@udb/protocol/src/framing.js";
import { MSG } from "@udb/protocol/src/messages.js";
import { fingerprintPublicKeyPem, verifySignedNonce, ensureDir } from "@udb/protocol/src/crypto.js";

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(name);
  if (idx === -1) return def;
  return args[idx + 1] ?? def;
}
function hasFlag(name) {
  return args.includes(name);
}

const TCP_PORT = Number(getArg("--tcp", "9910"));
const UDP_PORT = Number(getArg("--udp", "9909"));
const PAIRING = getArg("--pairing", "prompt"); // prompt | auto
const DEVICE_NAME = getArg("--name", os.hostname());

// Stream management (for services like shell)
const openStreams = new Map(); // streamId -> { type, process, socket, ... }
let nextStreamId = 1;

function generateStreamId() {
  return nextStreamId++;
}

// Security knobs
const NO_EXEC = hasFlag("--no-exec");
function listPaired() {
  return Object.entries(auth.keys).map(([fp, v]) => ({
    fp,
    name: v.name,
    addedAt: v.addedAt
  }));
}
const RESET_AUTH = hasFlag("--reset-auth");

// Root directory for file operations (push/pull)
// Default: ~/.udbd/files  (safe-ish sandbox)
const stateDir = path.join(os.homedir(), ".udbd");
ensureDir(stateDir);

const filesRoot = path.resolve(getArg("--root", path.join(stateDir, "files")));
ensureDir(filesRoot);

const authPath = path.join(stateDir, "authorized_keys.json");
const logPath = path.join(stateDir, "udbd.log");

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}\n`;
  fs.appendFileSync(logPath, msg);
  process.stdout.write(msg);
}

function loadAuth() {
  if (RESET_AUTH) {
    try { fs.unlinkSync(authPath); } catch {}
    return { keys: {} };
  }
  if (!fs.existsSync(authPath)) return { keys: {} };
  try {
    return JSON.parse(fs.readFileSync(authPath, "utf8"));
  } catch {
    return { keys: {} };
  }
}
function saveAuth(auth) {
  fs.writeFileSync(authPath, JSON.stringify(auth, null, 2));
}

function unpairAll() {
  const count = Object.keys(auth.keys).length;
  auth.keys = {};
  saveAuth(auth);
  return count;
}

const auth = loadAuth();

function isAuthorized(pubKeyPem) {
  const fp = fingerprintPublicKeyPem(pubKeyPem);
  return Boolean(auth.keys[fp]);
}

async function promptYesNo(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = (d) => {
      const s = String(d).trim().toLowerCase();
      process.stdin.off("data", onData);
      resolve(s === "y" || s === "yes");
    };
    process.stdin.on("data", onData);
  });
}

function execCommand(cmd, cb) {
  const opts = { timeout: 30_000, maxBuffer: 5 * 1024 * 1024 };

  if (os.platform() === "win32") {
    execFile("cmd.exe", ["/d", "/s", "/c", cmd], opts, cb);
  } else {
    execFile("/bin/sh", ["-lc", cmd], opts, cb);
  }
}

// Resolve a user-supplied path into filesRoot safely.
// Accepts paths like:
//   "/foo/bar.txt"   -> filesRoot/foo/bar.txt
//   "foo/bar.txt"    -> filesRoot/foo/bar.txt
// Rejects path traversal outside filesRoot.
function resolveInRoot(p) {
  const raw = String(p ?? "").trim();
  if (!raw) return null;

  // Treat absolute paths as rooted inside filesRoot (do NOT allow filesystem absolute)
  const normalized = raw.startsWith("/") ? raw.slice(1) : raw;

  const full = path.resolve(filesRoot, normalized);
  if (!full.startsWith(filesRoot + path.sep) && full !== filesRoot) return null;
  return full;
}

// UDP discovery: client broadcasts "UDB_DISCOVER_V1"
const udp = dgram.createSocket("udp4");
udp.on("message", (msg, rinfo) => {
  const text = msg.toString("utf8").trim();
  if (text !== "UDB_DISCOVER_V1") return;

  const payload = JSON.stringify({
    name: DEVICE_NAME,
    tcpPort: TCP_PORT,
    udpPort: UDP_PORT
  });

  udp.send(Buffer.from(payload, "utf8"), rinfo.port, rinfo.address);
});
udp.bind(UDP_PORT, "0.0.0.0", () => {
  udp.setBroadcast(true);
  log(`UDP discovery listening on :${UDP_PORT}`);
});

// TCP server
const server = net.createServer((socket) => {
  socket.setNoDelay(true);

  let clientPubKey = null;
  let clientName = "unknown";
  let authed = false;
  let pendingNonce = null;
  let pendingNonceExpiresAt = 0;

  const decoder = createFrameDecoder(async (m) => {
    try {
      // framing.js may emit {type:"error"...}
      if (m?.type === "error") {
        socket.write(encodeFrame({ type: MSG.ERROR, error: m.error || "decode_error", detail: m }));
        socket.end();
        return;
      }

      if (m.type === MSG.HELLO) {
        clientName = m.clientName ?? "unknown";
        clientPubKey = m.pubKey;

        // Protocol version negotiation (Phase 4)
        const clientProtocol = m.protocol ?? 1; // Default to 1 for backward compat
        const SUPPORTED_PROTOCOL = 1;
        
        if (clientProtocol > SUPPORTED_PROTOCOL) {
          socket.write(encodeFrame({ 
            type: MSG.ERROR, 
            error: "unsupported_protocol", 
            supported: [SUPPORTED_PROTOCOL], 
            got: clientProtocol 
          }));
          socket.end();
          return;
        }

        if (!clientPubKey) {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "missing_pubkey" }));
          socket.end();
          return;
        }

        if (!isAuthorized(clientPubKey)) {
          socket.write(encodeFrame({ type: MSG.AUTH_REQUIRED, reason: "not_paired" }));
        } else {
          pendingNonce = crypto.randomBytes(24).toString("base64");
          pendingNonceExpiresAt = Date.now() + 30_000;

          socket.write(
            encodeFrame({
              type: MSG.AUTH_CHALLENGE,
              nonce: pendingNonce,
              expiresInMs: 30_000
            })
          );
        }
        return;
      }

      if (m.type === MSG.AUTH_RESPONSE) {
        if (!clientPubKey) {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "hello_required" }));
          return;
        }
        if (!pendingNonce || Date.now() > pendingNonceExpiresAt) {
          socket.write(encodeFrame({ type: MSG.AUTH_FAIL, reason: "nonce_expired" }));
          return;
        }

        const ok = verifySignedNonce({
          publicKeyPem: clientPubKey,
          nonce: pendingNonce,
          signatureB64: String(m.signatureB64 ?? "")
        });

        if (!ok) {
          socket.write(encodeFrame({ type: MSG.AUTH_FAIL, reason: "bad_signature" }));
          return;
        }

        authed = true;
        pendingNonce = null;
        pendingNonceExpiresAt = 0;

        socket.write(encodeFrame({ type: MSG.AUTH_OK, deviceName: DEVICE_NAME }));
        return;
      }

      if (m.type === MSG.PAIR_REQUEST) {
        if (!clientPubKey) {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "hello_required" }));
          return;
        }

        const fp = fingerprintPublicKeyPem(clientPubKey);

        let ok = false;
        if (PAIRING === "auto") {
          ok = true;
        } else {
          log(`Pair request from ${clientName} fp=${fp}`);
          ok = await promptYesNo(`Allow pairing from ${clientName} (${fp})? [y/N] `);
        }

        if (!ok) {
          socket.write(encodeFrame({ type: MSG.PAIR_DENIED }));
          return;
        }

        auth.keys[fp] = { name: clientName, addedAt: new Date().toISOString() };
        saveAuth(auth);
        authed = true;

        socket.write(encodeFrame({ type: MSG.PAIR_OK, deviceName: DEVICE_NAME }));
        return;
      }

      // Pre-auth services: services and info (allowed without authentication)
      if (m.type === MSG.OPEN_SERVICE) {
        const serviceName = String(m.service ?? "").trim();
        const streamId = m.streamId || generateStreamId();

        // "services" service - returns capabilities (pre-auth allowed)
        if (serviceName === "services") {
          const servicesPayload = {
            type: "services",
            services: {
              shell: { pty: true, resize: true },
              exec: { oneShot: true, enabled: !NO_EXEC },
              fs: { push: true, pull: true },
              logs: { follow: true },
              status: { requestResponse: true },
              pairing: { mode: PAIRING },
              services: { preAuth: true },
              info: { preAuth: true },
              ping: { preAuth: true },
              shutdown: { requiresAuth: true, enabled: true },
              restart: { requiresAuth: true, enabled: true }
            }
          };

          socket.write(encodeFrame({
            type: MSG.STREAM_DATA,
            streamId,
            b64: Buffer.from(JSON.stringify(servicesPayload)).toString("base64")
          }));

          socket.write(encodeFrame({
            type: MSG.STREAM_CLOSE,
            streamId
          }));

          log(`SERVICES query answered`);
          return;
        }

        // "info" service - returns daemon metadata (pre-auth allowed)
        if (serviceName === "info") {
          const infoPayload = {
            type: "info",
            name: DEVICE_NAME,
            version: "0.7.0",
            build: process.env.UDB_BUILD || "unknown",
            platform: os.platform(),
            arch: os.arch(),
            deviceType: "embedded-linux",
            pairingMode: PAIRING,
            execEnabled: !NO_EXEC,
            root: FILES_ROOT,
            tcpPort: TCP_PORT,
            udpPort: UDP_PORT,
            protocol: 1
          };

          socket.write(encodeFrame({
            type: MSG.STREAM_DATA,
            streamId,
            b64: Buffer.from(JSON.stringify(infoPayload)).toString("base64")
          }));

          socket.write(encodeFrame({
            type: MSG.STREAM_CLOSE,
            streamId
          }));

          log(`INFO query answered`);
          return;
        }

        // "ping" service - cheap health check (pre-auth allowed)
        if (serviceName === "ping") {
          const pingPayload = {
            type: "pong",
            time: Date.now(),
            name: DEVICE_NAME,
            uptime: process.uptime()
          };

          socket.write(encodeFrame({
            type: MSG.STREAM_DATA,
            streamId,
            b64: Buffer.from(JSON.stringify(pingPayload)).toString("base64")
          }));

          socket.write(encodeFrame({
            type: MSG.STREAM_CLOSE,
            streamId
          }));

          log(`PING answered`);
          return;
        }

        // "shutdown" service - requires auth
        if (serviceName === "shutdown") {
          if (!authed) {
            socket.write(encodeFrame({
              type: MSG.SERVICE_ERROR,
              streamId,
              error: "auth_required"
            }));
            return;
          }

          const shutdownPayload = {
            type: "shutdown",
            message: "Daemon shutting down",
            time: Date.now()
          };

          socket.write(encodeFrame({
            type: MSG.STREAM_DATA,
            streamId,
            b64: Buffer.from(JSON.stringify(shutdownPayload)).toString("base64")
          }));

          socket.write(encodeFrame({
            type: MSG.STREAM_CLOSE,
            streamId
          }));

          log(`SHUTDOWN requested by ${clientName}`);
          
          // Schedule shutdown after sending response
          setTimeout(() => {
            log("Daemon shutting down...");
            process.exit(0);
          }, 100);
          return;
        }

        // "restart" service - requires auth
        if (serviceName === "restart") {
          if (!authed) {
            socket.write(encodeFrame({
              type: MSG.SERVICE_ERROR,
              streamId,
              error: "auth_required"
            }));
            return;
          }

          // On Linux, we exit with code 42 - systemd or wrapper script can restart us
          const restartPayload = {
            type: "restart",
            message: "Daemon restarting (exit code 42)",
            time: Date.now()
          };

          socket.write(encodeFrame({
            type: MSG.STREAM_DATA,
            streamId,
            b64: Buffer.from(JSON.stringify(restartPayload)).toString("base64")
          }));

          socket.write(encodeFrame({
            type: MSG.STREAM_CLOSE,
            streamId
          }));

          log(`RESTART requested by ${clientName}`);
          
          // Exit with code 42 to signal restart
          setTimeout(() => {
            log("Daemon restarting (exit 42)...");
            process.exit(42);
          }, 100);
          return;
        }
      }

      if (!authed) {
        socket.write(encodeFrame({ type: MSG.AUTH_REQUIRED, reason: "session_not_authenticated" }));
        return;
      }

        if (m.type === MSG.STATUS) {
          socket.write(
            encodeFrame({
              type: MSG.STATUS_RESULT,
              deviceName: DEVICE_NAME,
              execEnabled: !NO_EXEC,
              pairingMode: PAIRING,
              pairedCount: Object.keys(auth.keys).length
            })
          );
          return;
        }

        if (m.type === MSG.LIST_PAIRED) {
          socket.write(
            encodeFrame({
              type: MSG.LIST_PAIRED_RESULT,
              devices: listPaired()
            })
          );
          return;
        }

        if (m.type === MSG.UNPAIR_REQUEST) {
            if (!clientPubKey) {
              socket.write(encodeFrame({ type: MSG.ERROR, error: "hello_required" }));
              return;
            }

            const requesterFp = fingerprintPublicKeyPem(clientPubKey);

            // Admin: unpair all
            if (m.all === true) {
              const removed = unpairAll();
              authed = false;
              socket.write(
                encodeFrame({
                  type: MSG.UNPAIR_OK,
                  removed,
                  scope: "all"
                })
              );
              log(`UNPAIR_ALL by fp=${requesterFp} removed=${removed}`);
              return;
            }

            // Admin: unpair specific fingerprint
            if (typeof m.fp === "string") {
              if (auth.keys[m.fp]) {
                delete auth.keys[m.fp];
                saveAuth(auth);
                socket.write(
                  encodeFrame({
                    type: MSG.UNPAIR_OK,
                    removed: true,
                    fp: m.fp
                  })
                );
                log(`UNPAIR fp=${m.fp} by admin fp=${requesterFp}`);
              } else {
                socket.write(
                  encodeFrame({
                    type: MSG.UNPAIR_OK,
                    removed: false,
                    fp: m.fp
                  })
                );
              }
              return;
            }

            // Default: unpair self
            if (auth.keys[requesterFp]) {
              delete auth.keys[requesterFp];
              saveAuth(auth);
              authed = false;
              socket.write(
                encodeFrame({
                  type: MSG.UNPAIR_OK,
                  removed: true,
                  fp: requesterFp
                })
              );
              log(`UNPAIR self fp=${requesterFp}`);
            } else {
              socket.write(
                encodeFrame({
                  type: MSG.UNPAIR_OK,
                  removed: false,
                  fp: requesterFp
                })
              );
            }
            return;
        }

      // Stream-based services
      if (m.type === MSG.OPEN_SERVICE) {
        const serviceName = String(m.service ?? "").trim();
        const streamId = m.streamId || generateStreamId();

        if (serviceName === "shell") {
          try {
            const shell = process.env.SHELL || (os.platform() === "win32" ? "cmd.exe" : "/bin/sh");
            const shellArgs = os.platform() === "win32" ? [] : [];

            const ptyProcess = pty.spawn(shell, shellArgs, {
              name: "xterm-color",
              cols: m.cols || 80,
              rows: m.rows || 24,
              cwd: process.cwd(),
              env: process.env
            });

            const stream = {
              type: "shell",
              streamId,
              process: ptyProcess,
              socket
            };

            openStreams.set(streamId, stream);

            // Stream data from PTY to client
            ptyProcess.onData((data) => {
              socket.write(
                encodeFrame({
                  type: MSG.STREAM_DATA,
                  streamId,
                  b64: data.toString("base64")
                })
              );
            });

            // Handle PTY exit
            ptyProcess.onExit(() => {
              openStreams.delete(streamId);
              socket.write(
                encodeFrame({
                  type: MSG.STREAM_CLOSE,
                  streamId
                })
              );
            });

            // Don't send initial message - let shell prompt appear naturally

            log(`SHELL service opened streamId=${streamId}`);
          } catch (err) {
            socket.write(
              encodeFrame({
                type: MSG.SERVICE_ERROR,
                streamId,
                error: "shell_spawn_failed",
                detail: err.message
              })
            );
          }
          return;
        }

        socket.write(
          encodeFrame({
            type: MSG.SERVICE_ERROR,
            streamId,
            error: "unknown_service",
            detail: serviceName
          })
        );
        return;
      }

      // Stream data handling (input from client)
      if (m.type === MSG.STREAM_DATA) {
        const streamId = m.streamId;
        const stream = openStreams.get(streamId);

        if (!stream) {
          socket.write(
            encodeFrame({
              type: MSG.SERVICE_ERROR,
              streamId,
              error: "stream_not_found"
            })
          );
          return;
        }

        if (stream.type === "shell") {
          try {
            const data = Buffer.from(m.b64 || "", "base64");
            stream.process.write(data);
          } catch (err) {
            socket.write(
              encodeFrame({
                type: MSG.SERVICE_ERROR,
                streamId,
                error: "stream_write_failed",
                detail: err.message
              })
            );
          }
        }
        return;
      }

      // Stream resize
      if (m.type === MSG.STREAM_RESIZE) {
        const streamId = m.streamId;
        const stream = openStreams.get(streamId);

        if (stream && stream.type === "shell") {
          try {
            stream.process.resize(m.cols || 80, m.rows || 24);
          } catch (err) {
            log(`RESIZE failed: ${err.message}`);
          }
        }
        return;
      }

      if (m.type === MSG.EXEC) {
        if (NO_EXEC) {
          socket.write(encodeFrame({ type: MSG.EXEC_RESULT, code: 126, stdout: "", stderr: "exec disabled on device (--no-exec)" }));
          return;
        }

        const cmd = String(m.cmd ?? "").trim();
        if (!cmd) {
          socket.write(encodeFrame({ type: MSG.EXEC_RESULT, code: 1, stdout: "", stderr: "empty cmd" }));
          return;
        }

        execCommand(cmd, (err, stdout, stderr) => {
          socket.write(
            encodeFrame({
              type: MSG.EXEC_RESULT,
              code: err?.code ?? 0,
              stdout: stdout ?? "",
              stderr: stderr ?? (err ? String(err.message) : "")
            })
          );
        });
        return;
      }

      if (m.type === MSG.LOGS) {
        const last = Number(m.last ?? 200);
        const follow = Boolean(m.follow ?? true);

        const sendLast = () => {
          if (!fs.existsSync(logPath)) return;
          const lines = fs.readFileSync(logPath, "utf8").split("\n");
          const slice = lines.slice(Math.max(0, lines.length - last)).join("\n");
          socket.write(encodeFrame({ type: MSG.LOGS_CHUNK, text: slice + "\n" }));
        };

        sendLast();

        if (!follow) return;

        let lastSize = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
        const t = setInterval(() => {
          if (socket.destroyed) {
            clearInterval(t);
            return;
          }
          if (!fs.existsSync(logPath)) return;
          const st = fs.statSync(logPath);
          if (st.size > lastSize) {
            const fd = fs.openSync(logPath, "r");
            const buf = Buffer.alloc(st.size - lastSize);
            fs.readSync(fd, buf, 0, buf.length, lastSize);
            fs.closeSync(fd);
            lastSize = st.size;
            socket.write(encodeFrame({ type: MSG.LOGS_CHUNK, text: buf.toString("utf8") }));
          }
        }, 500);

        socket.on("close", () => clearInterval(t));
        return;
      }

      // PUSH protocol (base64 chunking) — restricted to filesRoot
      if (m.type === MSG.PUSH_BEGIN) {
        const desired = String(m.remotePath ?? "").trim();
        const resolved = resolveInRoot(desired);
        if (!resolved) {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "invalid_remote_path" }));
          return;
        }

        ensureDir(path.dirname(resolved));

        const tmp = path.join(stateDir, `push_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.tmp`);
        const ws = fs.createWriteStream(tmp);

        socket._udbPush = { ws, tmp, resolved, desired };
        socket.write(encodeFrame({ type: "push_ready" }));
        return;
      }

      if (m.type === MSG.PUSH_CHUNK) {
        const s = socket._udbPush;
        if (!s) {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "push_not_started" }));
          return;
        }
        const data = Buffer.from(String(m.b64 ?? ""), "base64");
        s.ws.write(data);
        socket.write(encodeFrame({ type: "push_ack", n: data.length }));
        return;
      }

      if (m.type === MSG.PUSH_END) {
        const s = socket._udbPush;
        if (!s) {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "push_not_started" }));
          return;
        }
        s.ws.end(() => {
          fs.renameSync(s.tmp, s.resolved);
          delete socket._udbPush;
          socket.write(encodeFrame({ type: "push_ok", remotePath: s.desired }));
          log(`PUSH saved to ${s.resolved}`);
        });
        return;
      }

      // PULL protocol — restricted to filesRoot
      if (m.type === MSG.PULL_BEGIN) {
        const desired = String(m.remotePath ?? "").trim();
        const resolved = resolveInRoot(desired);
        if (!resolved) {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "invalid_remote_path" }));
          return;
        }
        if (!fs.existsSync(resolved)) {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "file_not_found" }));
          return;
        }

        const rs = fs.createReadStream(resolved, { highWaterMark: 64 * 1024 });
        socket.write(encodeFrame({ type: MSG.PULL_BEGIN, remotePath: desired }));

        rs.on("data", (chunk) => {
          socket.write(encodeFrame({ type: MSG.PULL_CHUNK, b64: chunk.toString("base64") }));
        });
        rs.on("end", () => socket.write(encodeFrame({ type: MSG.PULL_END })));
        rs.on("error", (e) => {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "pull_failed", detail: String(e.message) }));
        });
        return;
      }

      socket.write(encodeFrame({ type: MSG.ERROR, error: "unknown_message", got: m.type }));
    } catch (e) {
      socket.write(encodeFrame({ type: MSG.ERROR, error: "server_exception", detail: String(e.message) }));
    }
  });

  socket.on("data", decoder);
  socket.on("error", (e) => {
  if (e.code === "ECONNRESET") return; // normal client disconnect
  log(`socket error: ${e.message}`);
});

});

server.listen(TCP_PORT, "0.0.0.0", () => {
  log(
    `UDBD listening TCP on :${TCP_PORT} name=${DEVICE_NAME} pairing=${PAIRING} ` +
    `exec=${NO_EXEC ? "disabled" : "enabled"} root=${filesRoot}`
  );
});
