#!/usr/bin/env node
import net from "net";
import dgram from "dgram";
import os from "os";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

import { encodeFrame, createFrameDecoder } from "@udb/protocol/src/framing.js";
import { MSG } from "@udb/protocol/src/messages.js";
import { fingerprintPublicKeyPem, verifySignedNonce } from "@udb/protocol/src/crypto.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------- CONFIG -------------------- */

const args = process.argv.slice(2);

function getArg(name, def) {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return def;
}

function hasFlag(name) {
  return args.includes(name);
}

const HOST = getArg("--host", "0.0.0.0");
const TCP_PORT = Number(getArg("--tcp", "9910"));
const UDP_PORT = Number(getArg("--udp", "9909"));
const DEVICE_NAME = getArg("--name", os.hostname());
const PAIRING = getArg("--pairing", "auto");
const NO_EXEC = hasFlag("--no-exec");

/* -------------------- STATE -------------------- */

const stateDir = path.join(os.homedir(), ".udbd");
const filesRoot = path.join(stateDir, "files");
const logPath = path.join(stateDir, "udbd.log");
const authPath = path.join(stateDir, "authorized_keys.json");

fs.mkdirSync(filesRoot, { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logPath, line);
  process.stdout.write(line);
}

/* -------------------- AUTH MANAGEMENT -------------------- */

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

/* -------------------- UDP DISCOVERY -------------------- */

function startUdp() {
  const udp = dgram.createSocket("udp4");

  udp.on("message", (msg, rinfo) => {
    if (msg.toString().trim() !== "UDB_DISCOVER_V1") return;

    const payload = JSON.stringify({
      name: DEVICE_NAME,
      tcpPort: TCP_PORT,
      deviceType: "embedded-linux"
    });

    udp.send(Buffer.from(payload), rinfo.port, rinfo.address);
  });

  udp.bind(UDP_PORT, HOST, () => {
    udp.setBroadcast(true);
    log(`UDP discovery listening on ${HOST}:${UDP_PORT}`);
  });

  return udp;
}

/* -------------------- TCP SERVER -------------------- */

function startTcp() {
  const server = net.createServer((socket) => {
    socket.setNoDelay(true);

    let clientPubKey = null;
    let clientName = "unknown";
    let authed = false;
    let pendingNonce = null;
    let pendingNonceExpiresAt = 0;

    log(`Connection from ${socket.remoteAddress}`);

    const decoder = createFrameDecoder((m) => {
      try {
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

          const clientProtocol = m.protocol ?? 1;
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

          if (PAIRING === "auto") {
            auth.keys[fp] = { name: clientName, addedAt: new Date().toISOString() };
            saveAuth(auth);
            authed = true;
            log(`PAIR_OK for ${clientName} fp=${fp}`);
            socket.write(encodeFrame({ type: MSG.PAIR_OK, fingerprint: fp, deviceName: DEVICE_NAME }));
          } else {
            log(`PAIR_DENIED for ${clientName} (pairing mode: ${PAIRING})`);
            socket.write(encodeFrame({ type: MSG.PAIR_DENIED }));
          }
          return;
        }

        // Pre-auth services
        if (m.type === MSG.OPEN_SERVICE) {
          const serviceName = String(m.service ?? "").trim();
          const streamId = m.streamId || crypto.randomBytes(8).toString("hex");

          // "services" service
          if (serviceName === "services") {
            const servicesPayload = {
              type: "services",
              services: {
                shell: { pty: true, resize: true },
                exec: { oneShot: true },
                fs: { push: true, pull: true },
                status: { requestResponse: true },
                pairing: { mode: PAIRING },
                services: { preAuth: true },
                info: { preAuth: true },
                ping: { preAuth: true }
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

            return;
          }

          // "info" service
          if (serviceName === "info") {
            const infoPayload = {
              type: "info",
              name: DEVICE_NAME,
              version: "0.8.5",
              build: "linux",
              platform: process.platform,
              arch: process.arch,
              deviceType: "embedded-linux",
              pairingMode: PAIRING,
              execEnabled: !NO_EXEC,
              root: "/",
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

            return;
          }

          // "ping" service
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
              execEnabled: !NO_EXEC,
              pairingMode: PAIRING,
              pairedCount: Object.keys(auth.keys).length
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

        // EXEC - Real command execution
        if (m.type === MSG.EXEC) {
          if (NO_EXEC) {
            socket.write(encodeFrame({
              type: MSG.EXEC_RESULT,
              code: 1,
              stdout: "",
              stderr: "exec disabled"
            }));
            return;
          }

          const cmd = String(m.cmd ?? "").trim();
          log(`EXEC: ${cmd}`);

          if (!cmd) {
            socket.write(encodeFrame({ type: MSG.EXEC_RESULT, code: 1, stdout: "", stderr: "empty cmd" }));
            return;
          }

          // Execute command
          const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
          const args = process.platform === "win32" ? ["/c", cmd] : ["-c", cmd];

          const proc = spawn(shell, args, {
            cwd: filesRoot,
            stdio: ["ignore", "pipe", "pipe"]
          });

          let stdout = "";
          let stderr = "";

          proc.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
          });

          proc.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
          });

          proc.on("close", (code) => {
            socket.write(
              encodeFrame({
                type: MSG.EXEC_RESULT,
                code: code ?? 0,
                stdout,
                stderr
              })
            );
          });

          proc.on("error", (err) => {
            socket.write(
              encodeFrame({
                type: MSG.EXEC_RESULT,
                code: 1,
                stdout: "",
                stderr: err.message
              })
            );
          });

          return;
        }

        // Unknown message type
        socket.write(encodeFrame({ type: MSG.ERROR, error: "unknown_message_type", got: m.type }));
      } catch (err) {
        log(`Error handling message: ${err.message}`);
        socket.write(encodeFrame({ type: MSG.ERROR, error: "internal_error", message: err.message }));
      }
    });

    socket.on("data", decoder);
    socket.on("error", (err) => {
      if (err.code !== "ECONNRESET") {
        log(`Socket error: ${err.message}`);
      }
    });
  });

  server.on("error", (err) => {
    log(`Server error: ${err.message}`);
    process.exit(1);
  });

  server.listen(TCP_PORT, HOST, () => {
    log(`UDBD TCP listening on ${HOST}:${TCP_PORT}`);
  });

  return server;
}

/* -------------------- START -------------------- */

export function startDaemon() {
  log(`Starting UDB daemon`);
  log(`Name=${DEVICE_NAME} pairing=${PAIRING} exec=${!NO_EXEC}`);

  const udp = startUdp();
  const tcp = startTcp();

  return { udp, tcp };
}

/* -------------------- CLI ENTRY -------------------- */

if (process.argv[1] === __filename) {
  startDaemon();
  process.stdin.resume(); // keep alive
}
