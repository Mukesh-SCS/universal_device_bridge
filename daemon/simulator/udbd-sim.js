/**
 * UDB Simulator Daemon
 * 
 * A mock daemon for testing UDB workflows without physical hardware.
 * Returns simulated responses for all operations.
 * 
 * Usage:
 *   node udbd-sim.js [options]
 * 
 * Options:
 *   --name <name>      Device name (default: sim-device)
 *   --tcp <port>       TCP port (default: 9910)
 *   --udp <port>       UDP port (default: 9909)
 *   --pairing <mode>   Pairing mode: auto|prompt (default: auto)
 *   --latency <ms>     Simulated latency in ms (default: 50)
 */

import dgram from "node:dgram";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { encodeFrame, createFrameDecoder } from "@udb/protocol/src/framing.js";
import { MSG } from "@udb/protocol/src/messages.js";
import { fingerprintPublicKeyPem, verifySignedNonce, ensureDir } from "@udb/protocol/src/crypto.js";

/* ===================== Configuration ===================== */

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
const PAIRING = getArg("--pairing", "auto");
const DEVICE_NAME = getArg("--name", "sim-device");
const LATENCY = Number(getArg("--latency", "50"));
const VERBOSE = hasFlag("--verbose") || hasFlag("-v");

/* ===================== State ===================== */

const stateDir = path.join(os.homedir(), ".udbd-sim");
ensureDir(stateDir);

const authPath = path.join(stateDir, "authorized_keys.json");
const filesDir = path.join(stateDir, "files");
ensureDir(filesDir);

// Simulated filesystem
const virtualFs = new Map([
  ["/etc/hostname", DEVICE_NAME],
  ["/etc/os-release", 'NAME="UDB Simulator"\nVERSION="1.0.0"\nID=udb-sim'],
  ["/proc/uptime", "12345.67 11111.11"],
  ["/proc/version", "Linux version 5.15.0-sim (udb@simulator) (gcc version 11.2.0)"],
  ["/tmp/test.txt", "This is a test file from the simulator."]
]);

// Simulated command outputs
const commandOutputs = {
  "whoami": { stdout: "simulator\n", stderr: "", code: 0 },
  "hostname": { stdout: `${DEVICE_NAME}\n`, stderr: "", code: 0 },
  "uname": { stdout: "Linux\n", stderr: "", code: 0 },
  "uname -a": { stdout: `Linux ${DEVICE_NAME} 5.15.0-sim #1 SMP PREEMPT x86_64 GNU/Linux\n`, stderr: "", code: 0 },
  "uname -r": { stdout: "5.15.0-sim\n", stderr: "", code: 0 },
  "uname -n": { stdout: `${DEVICE_NAME}\n`, stderr: "", code: 0 },
  "pwd": { stdout: "/home/simulator\n", stderr: "", code: 0 },
  "id": { stdout: "uid=1000(simulator) gid=1000(simulator) groups=1000(simulator)\n", stderr: "", code: 0 },
  "date": { stdout: new Date().toUTCString() + "\n", stderr: "", code: 0 },
  "uptime": { stdout: " 12:34:56 up 3 days, 4:56, 1 user, load average: 0.00, 0.01, 0.05\n", stderr: "", code: 0 },
  "echo hello": { stdout: "hello\n", stderr: "", code: 0 },
  "cat /etc/hostname": { stdout: `${DEVICE_NAME}\n`, stderr: "", code: 0 },
  "ls": { stdout: "Desktop\nDocuments\nDownloads\n", stderr: "", code: 0 },
  "ls -la": { stdout: "total 12\ndrwxr-xr-x 5 simulator simulator 4096 Jan 21 12:00 .\ndrwxr-xr-x 3 root root 4096 Jan 21 10:00 ..\n-rw-r--r-- 1 simulator simulator 220 Jan 21 10:00 .bashrc\n", stderr: "", code: 0 },
  "ps": { stdout: "  PID TTY          TIME CMD\n    1 ?        00:00:01 init\n   42 pts/0    00:00:00 bash\n", stderr: "", code: 0 },
  "free -m": { stdout: "              total        used        free      shared  buff/cache   available\nMem:           4096        1024        2048         128        1024        2816\nSwap:          2048           0        2048\n", stderr: "", code: 0 },
  "df -h": { stdout: "Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        50G   10G   38G  21% /\n", stderr: "", code: 0 },
  "true": { stdout: "", stderr: "", code: 0 },
  "false": { stdout: "", stderr: "", code: 1 },
  "exit 0": { stdout: "", stderr: "", code: 0 },
  "exit 1": { stdout: "", stderr: "", code: 1 },
  "exit 42": { stdout: "", stderr: "", code: 42 }
};

// Stream management for shell simulation
const openStreams = new Map();
let nextStreamId = 1;

function generateStreamId() {
  return nextStreamId++;
}

/* ===================== Auth Management ===================== */

function loadAuth() {
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

const auth = loadAuth();

function isAuthorized(pubKeyPem) {
  const fp = fingerprintPublicKeyPem(pubKeyPem);
  return Boolean(auth.keys[fp]);
}

function listPaired() {
  return Object.entries(auth.keys).map(([fp, v]) => ({
    fp,
    name: v.name,
    addedAt: v.addedAt
  }));
}

function unpairAll() {
  const count = Object.keys(auth.keys).length;
  auth.keys = {};
  saveAuth(auth);
  return count;
}

/* ===================== Logging ===================== */

function log(line) {
  const msg = `[SIM ${new Date().toISOString()}] ${line}`;
  if (VERBOSE) {
    console.log(msg);
  }
}

/* ===================== Simulated Command Execution ===================== */

function simulateCommand(cmd) {
  // Check for exact match first
  if (commandOutputs[cmd]) {
    return { ...commandOutputs[cmd] };
  }

  // Handle echo commands
  if (cmd.startsWith("echo ")) {
    const text = cmd.slice(5);
    return { stdout: text + "\n", stderr: "", code: 0 };
  }

  // Handle cat commands
  if (cmd.startsWith("cat ")) {
    const filePath = cmd.slice(4).trim();
    if (virtualFs.has(filePath)) {
      return { stdout: virtualFs.get(filePath) + "\n", stderr: "", code: 0 };
    }
    return { stdout: "", stderr: `cat: ${filePath}: No such file or directory\n`, code: 1 };
  }

  // Handle sleep commands
  if (cmd.startsWith("sleep ")) {
    return { stdout: "", stderr: "", code: 0 };
  }

  // Handle exit commands
  const exitMatch = cmd.match(/^exit\s+(\d+)$/);
  if (exitMatch) {
    return { stdout: "", stderr: "", code: parseInt(exitMatch[1], 10) };
  }

  // Handle ls with path
  if (cmd.startsWith("ls ") && !cmd.includes("-")) {
    return { stdout: "file1.txt\nfile2.txt\ndir1\n", stderr: "", code: 0 };
  }

  // Default: command not found
  return {
    stdout: "",
    stderr: `${cmd.split(" ")[0]}: command not found (simulated)\n`,
    code: 127
  };
}

/* ===================== Delay Helper ===================== */

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ===================== UDP Discovery ===================== */

const udp = dgram.createSocket("udp4");

udp.on("message", (msg, rinfo) => {
  const text = msg.toString("utf8").trim();
  if (text !== "UDB_DISCOVER_V1") return;

  log(`Discovery request from ${rinfo.address}:${rinfo.port}`);

  const payload = JSON.stringify({
    name: DEVICE_NAME,
    tcpPort: TCP_PORT,
    udpPort: UDP_PORT,
    simulator: true
  });

  udp.send(Buffer.from(payload, "utf8"), rinfo.port, rinfo.address);
});

udp.bind(UDP_PORT, "0.0.0.0", () => {
  udp.setBroadcast(true);
  console.log(`[SIM] UDP discovery listening on :${UDP_PORT}`);
});

/* ===================== TCP Server ===================== */

const server = net.createServer((socket) => {
  socket.setNoDelay(true);

  let clientPubKey = null;
  let clientName = "unknown";
  let authed = false;
  let pendingNonce = null;
  let pendingNonceExpiresAt = 0;

  log(`Connection from ${socket.remoteAddress}`);

  const decoder = createFrameDecoder(async (m) => {
    try {
      // Add simulated latency
      if (LATENCY > 0) {
        await delay(LATENCY);
      }

      if (m?.type === "error") {
        socket.write(encodeFrame({ type: MSG.ERROR, error: m.error || "decode_error" }));
        socket.end();
        return;
      }

      // HELLO
      if (m.type === MSG.HELLO) {
        clientName = m.clientName ?? "unknown";
        clientPubKey = m.pubKey;

        log(`HELLO from ${clientName}`);

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

      // AUTH_RESPONSE
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
        log(`AUTH_OK for ${clientName}`);

        socket.write(encodeFrame({ type: MSG.AUTH_OK, deviceName: DEVICE_NAME }));
        return;
      }

      // PAIR_REQUEST
      if (m.type === MSG.PAIR_REQUEST) {
        if (!clientPubKey) {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "hello_required" }));
          return;
        }

        const fp = fingerprintPublicKeyPem(clientPubKey);

        // Auto-pair in simulator
        if (PAIRING === "auto") {
          auth.keys[fp] = { name: clientName, addedAt: new Date().toISOString() };
          saveAuth(auth);
          authed = true;
          log(`PAIR_OK for ${clientName} fp=${fp}`);
          socket.write(encodeFrame({ type: MSG.PAIR_OK, deviceName: DEVICE_NAME }));
        } else {
          log(`PAIR_DENIED for ${clientName} (pairing mode: ${PAIRING})`);
          socket.write(encodeFrame({ type: MSG.PAIR_DENIED }));
        }
        return;
      }

      // Pre-auth services: services and info (allowed without authentication)
      if (m.type === MSG.OPEN_SERVICE) {
        const serviceName = String(m.service ?? "").trim();
        const streamId = m.streamId || crypto.randomBytes(8).toString("hex");

        // "services" service - returns capabilities (pre-auth allowed)
        if (serviceName === "services") {
          const servicesPayload = {
            type: "services",
            services: {
              shell: { pty: true, resize: true, simulated: true },
              exec: { oneShot: true, simulated: true },
              fs: { push: true, pull: true, simulated: true },
              logs: { follow: true, simulated: true },
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
            build: "simulator",
            platform: "linux",
            arch: "x86_64",
            deviceType: "simulator",
            pairingMode: PAIRING,
            execEnabled: true,
            root: "/",
            tcpPort: TCP_PORT,
            udpPort: UDP_PORT,
            protocol: 1,
            simulator: true
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
            console.log("[SIM] Shutting down...");
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

          const restartPayload = {
            type: "restart",
            message: "Daemon restarting (simulated - no actual restart in simulator)",
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

          log(`RESTART requested by ${clientName} (simulated)`);
          return;
        }
      }

      // Require auth for remaining operations
      if (!authed) {
        socket.write(encodeFrame({ type: MSG.AUTH_REQUIRED, reason: "session_not_authenticated" }));
        return;
      }

      // STATUS
      if (m.type === MSG.STATUS) {
        log(`STATUS request`);
        socket.write(
          encodeFrame({
            type: MSG.STATUS_RESULT,
            deviceName: DEVICE_NAME,
            execEnabled: true,
            pairingMode: PAIRING,
            pairedCount: Object.keys(auth.keys).length,
            simulator: true
          })
        );
        return;
      }

      // LIST_PAIRED
      if (m.type === MSG.LIST_PAIRED) {
        socket.write(
          encodeFrame({
            type: MSG.LIST_PAIRED_RESULT,
            devices: listPaired()
          })
        );
        return;
      }

      // UNPAIR_REQUEST
      if (m.type === MSG.UNPAIR_REQUEST) {
        const requesterFp = fingerprintPublicKeyPem(clientPubKey);

        if (m.all === true) {
          const removed = unpairAll();
          authed = false;
          log(`UNPAIR_ALL removed=${removed}`);
          socket.write(encodeFrame({ type: MSG.UNPAIR_OK, removed, scope: "all" }));
          return;
        }

        if (typeof m.fp === "string") {
          if (auth.keys[m.fp]) {
            delete auth.keys[m.fp];
            saveAuth(auth);
            socket.write(encodeFrame({ type: MSG.UNPAIR_OK, removed: true, fp: m.fp }));
          } else {
            socket.write(encodeFrame({ type: MSG.UNPAIR_OK, removed: false, fp: m.fp }));
          }
          return;
        }

        if (auth.keys[requesterFp]) {
          delete auth.keys[requesterFp];
          saveAuth(auth);
          authed = false;
          socket.write(encodeFrame({ type: MSG.UNPAIR_OK, removed: true, fp: requesterFp }));
        } else {
          socket.write(encodeFrame({ type: MSG.UNPAIR_OK, removed: false, fp: requesterFp }));
        }
        return;
      }

      // EXEC - Simulated
      if (m.type === MSG.EXEC) {
        const cmd = String(m.cmd ?? "").trim();
        log(`EXEC: ${cmd}`);

        if (!cmd) {
          socket.write(encodeFrame({ type: MSG.EXEC_RESULT, code: 1, stdout: "", stderr: "empty cmd" }));
          return;
        }

        const result = simulateCommand(cmd);
        socket.write(
          encodeFrame({
            type: MSG.EXEC_RESULT,
            code: result.code,
            stdout: result.stdout,
            stderr: result.stderr
          })
        );
        return;
      }

      // OPEN_SERVICE (shell simulation)
      if (m.type === MSG.OPEN_SERVICE) {
        const serviceName = String(m.service ?? "").trim();
        const streamId = m.streamId || generateStreamId();

        if (serviceName === "shell") {
          log(`SHELL service opened streamId=${streamId}`);

          const stream = {
            type: "shell",
            streamId,
            buffer: "",
            socket
          };
          openStreams.set(streamId, stream);

          // Send initial prompt
          socket.write(
            encodeFrame({
              type: MSG.STREAM_DATA,
              streamId,
              b64: Buffer.from(`${DEVICE_NAME}:~$ `).toString("base64")
            })
          );
          return;
        }

        socket.write(
          encodeFrame({
            type: MSG.SERVICE_ERROR,
            streamId,
            error: "unknown_service"
          })
        );
        return;
      }

      // STREAM_DATA (shell input)
      if (m.type === MSG.STREAM_DATA) {
        const streamId = m.streamId;
        const stream = openStreams.get(streamId);

        if (!stream) {
          socket.write(encodeFrame({ type: MSG.SERVICE_ERROR, streamId, error: "stream_not_found" }));
          return;
        }

        const data = Buffer.from(m.b64 || "", "base64").toString();
        stream.buffer += data;

        // Echo back the input
        socket.write(
          encodeFrame({
            type: MSG.STREAM_DATA,
            streamId,
            b64: Buffer.from(data).toString("base64")
          })
        );

        // Check for newline (command submission)
        if (data.includes("\r") || data.includes("\n")) {
          const cmd = stream.buffer.trim();
          stream.buffer = "";

          if (cmd === "exit") {
            socket.write(encodeFrame({ type: MSG.STREAM_CLOSE, streamId }));
            openStreams.delete(streamId);
            return;
          }

          // Execute and send result
          const result = simulateCommand(cmd);
          const output = result.stdout + result.stderr;
          
          socket.write(
            encodeFrame({
              type: MSG.STREAM_DATA,
              streamId,
              b64: Buffer.from("\n" + output + `${DEVICE_NAME}:~$ `).toString("base64")
            })
          );
        }
        return;
      }

      // STREAM_CLOSE
      if (m.type === MSG.STREAM_CLOSE) {
        const streamId = m.streamId;
        openStreams.delete(streamId);
        log(`STREAM_CLOSE streamId=${streamId}`);
        return;
      }

      // STREAM_RESIZE
      if (m.type === MSG.STREAM_RESIZE) {
        // Just acknowledge - no real PTY in simulator
        log(`STREAM_RESIZE streamId=${m.streamId} cols=${m.cols} rows=${m.rows}`);
        return;
      }

      // PUSH_BEGIN
      if (m.type === MSG.PUSH_BEGIN) {
        const remotePath = String(m.remotePath ?? "").trim();
        log(`PUSH_BEGIN: ${remotePath}`);
        
        socket._simPush = { remotePath, chunks: [] };
        socket.write(encodeFrame({ type: "push_ready" }));
        return;
      }

      // PUSH_CHUNK
      if (m.type === MSG.PUSH_CHUNK) {
        if (!socket._simPush) {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "push_not_started" }));
          return;
        }
        const data = Buffer.from(String(m.b64 ?? ""), "base64");
        socket._simPush.chunks.push(data);
        socket.write(encodeFrame({ type: "push_ack", n: data.length }));
        return;
      }

      // PUSH_END
      if (m.type === MSG.PUSH_END) {
        if (!socket._simPush) {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "push_not_started" }));
          return;
        }
        
        const fullData = Buffer.concat(socket._simPush.chunks);
        const remotePath = socket._simPush.remotePath;
        
        // Store in virtual filesystem
        virtualFs.set(remotePath, fullData.toString());
        
        // Also save to disk for persistence
        const safePath = path.join(filesDir, remotePath.replace(/[^a-zA-Z0-9._-]/g, "_"));
        fs.writeFileSync(safePath, fullData);
        
        log(`PUSH complete: ${remotePath} (${fullData.length} bytes)`);
        delete socket._simPush;
        socket.write(encodeFrame({ type: "push_ok", remotePath }));
        return;
      }

      // PULL_BEGIN
      if (m.type === MSG.PULL_BEGIN) {
        const remotePath = String(m.remotePath ?? "").trim();
        log(`PULL_BEGIN: ${remotePath}`);

        if (!virtualFs.has(remotePath)) {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "file_not_found" }));
          return;
        }

        const content = virtualFs.get(remotePath);
        const data = Buffer.from(content);
        
        socket.write(encodeFrame({ type: MSG.PULL_BEGIN, remotePath }));
        socket.write(encodeFrame({ type: MSG.PULL_CHUNK, b64: data.toString("base64") }));
        socket.write(encodeFrame({ type: MSG.PULL_END }));
        return;
      }

      socket.write(encodeFrame({ type: MSG.ERROR, error: "unknown_message", got: m.type }));

    } catch (e) {
      log(`Error: ${e.message}`);
      socket.write(encodeFrame({ type: MSG.ERROR, error: "server_exception", detail: String(e.message) }));
    }
  });

  socket.on("data", decoder);
  socket.on("error", (e) => {
    if (e.code === "ECONNRESET") return;
    log(`Socket error: ${e.message}`);
  });
  socket.on("close", () => {
    log(`Connection closed from ${socket.remoteAddress}`);
  });
});

server.listen(TCP_PORT, "0.0.0.0", () => {
  console.log(`[SIM] UDB Simulator listening on TCP :${TCP_PORT}`);
  console.log(`[SIM] Device name: ${DEVICE_NAME}`);
  console.log(`[SIM] Pairing mode: ${PAIRING}`);
  console.log(`[SIM] Latency: ${LATENCY}ms`);
  console.log(`[SIM] State directory: ${stateDir}`);
});
