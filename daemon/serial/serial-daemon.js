/**
 * Serial Loopback / Virtual Serial Daemon
 * 
 * A testing daemon that works over virtual serial ports.
 * Uses the same protocol as TCP - validates transport independence.
 * 
 * Usage:
 *   node serial-daemon.js [options]
 * 
 * Options:
 *   --port <path>     Serial port path (required)
 *   --baud <rate>     Baud rate (default: 115200)
 *   --name <name>     Device name (default: serial-device)
 *   --pairing <mode>  Pairing mode: auto|prompt (default: auto)
 *   --verbose         Enable verbose logging
 * 
 * For testing on Windows, use com0com to create virtual serial port pairs.
 * For testing on Linux, use socat to create virtual serial port pairs:
 *   socat -d -d pty,raw,echo=0 pty,raw,echo=0
 * 
 * Example:
 *   node serial-daemon.js --port COM3 --name my-serial-device
 */

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

const SERIAL_PORT = getArg("--port", null);
const BAUD_RATE = Number(getArg("--baud", "115200"));
const PAIRING = getArg("--pairing", "auto");
const DEVICE_NAME = getArg("--name", "serial-device");
const VERBOSE = hasFlag("--verbose") || hasFlag("-v");

if (!SERIAL_PORT) {
  console.error("Usage: node serial-daemon.js --port <path> [options]");
  console.error("\nOptions:");
  console.error("  --port <path>     Serial port path (required)");
  console.error("  --baud <rate>     Baud rate (default: 115200)");
  console.error("  --name <name>     Device name (default: serial-device)");
  console.error("  --pairing <mode>  Pairing mode: auto|prompt (default: auto)");
  console.error("  --verbose         Enable verbose logging");
  process.exit(1);
}

/* ===================== State ===================== */

const stateDir = path.join(os.homedir(), ".udbd-serial");
ensureDir(stateDir);

const authPath = path.join(stateDir, "authorized_keys.json");
const filesDir = path.join(stateDir, "files");
ensureDir(filesDir);

// Simulated command outputs (same as simulator)
const commandOutputs = {
  "whoami": { stdout: "serial-user\n", stderr: "", code: 0 },
  "hostname": { stdout: `${DEVICE_NAME}\n`, stderr: "", code: 0 },
  "uname": { stdout: "Linux\n", stderr: "", code: 0 },
  "uname -a": { stdout: `Linux ${DEVICE_NAME} 5.15.0-serial #1 SMP PREEMPT armv7l GNU/Linux\n`, stderr: "", code: 0 },
  "pwd": { stdout: "/home/serial-user\n", stderr: "", code: 0 },
  "id": { stdout: "uid=1000(serial-user) gid=1000(serial-user) groups=1000(serial-user)\n", stderr: "", code: 0 },
  "date": { stdout: new Date().toUTCString() + "\n", stderr: "", code: 0 },
  "echo hello": { stdout: "hello\n", stderr: "", code: 0 },
  "true": { stdout: "", stderr: "", code: 0 },
  "false": { stdout: "", stderr: "", code: 1 },
};

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

/* ===================== Logging ===================== */

function log(line) {
  const msg = `[SERIAL ${new Date().toISOString()}] ${line}`;
  if (VERBOSE) {
    console.log(msg);
  }
}

/* ===================== Command Execution ===================== */

function simulateCommand(cmd) {
  if (commandOutputs[cmd]) {
    return { ...commandOutputs[cmd] };
  }

  if (cmd.startsWith("echo ")) {
    return { stdout: cmd.slice(5) + "\n", stderr: "", code: 0 };
  }

  return {
    stdout: "",
    stderr: `${cmd.split(" ")[0]}: command not found\n`,
    code: 127
  };
}

/* ===================== Main ===================== */

async function main() {
  // Dynamic import serialport
  let SerialPort;
  try {
    const sp = await import("serialport");
    SerialPort = sp.SerialPort;
  } catch (err) {
    console.error("Error: serialport module not installed.");
    console.error("Run: npm install serialport");
    process.exit(1);
  }

  console.log(`[SERIAL] Opening ${SERIAL_PORT} at ${BAUD_RATE} baud...`);

  const port = new SerialPort({
    path: SERIAL_PORT,
    baudRate: BAUD_RATE
  });

  let clientPubKey = null;
  let clientName = "unknown";
  let authed = false;
  let pendingNonce = null;
  let pendingNonceExpiresAt = 0;

  port.on("open", () => {
    console.log(`[SERIAL] Daemon listening on ${SERIAL_PORT}`);
    console.log(`[SERIAL] Device name: ${DEVICE_NAME}`);
    console.log(`[SERIAL] Pairing mode: ${PAIRING}`);
  });

  port.on("error", (err) => {
    console.error(`[SERIAL] Error: ${err.message}`);
  });

  const decoder = createFrameDecoder((m) => {
    try {
      if (m?.type === "error") {
        port.write(encodeFrame({ type: MSG.ERROR, error: m.error || "decode_error" }));
        return;
      }

      // HELLO
      if (m.type === MSG.HELLO) {
        clientName = m.clientName ?? "unknown";
        clientPubKey = m.pubKey;

        log(`HELLO from ${clientName}`);

        // Protocol version negotiation
        const clientProtocol = m.protocol ?? 1;
        const SUPPORTED_PROTOCOL = 1;
        
        if (clientProtocol > SUPPORTED_PROTOCOL) {
          port.write(encodeFrame({ 
            type: MSG.ERROR, 
            error: "unsupported_protocol", 
            supported: [SUPPORTED_PROTOCOL], 
            got: clientProtocol 
          }));
          return;
        }

        if (!clientPubKey) {
          port.write(encodeFrame({ type: MSG.ERROR, error: "missing_pubkey" }));
          return;
        }

        if (!isAuthorized(clientPubKey)) {
          port.write(encodeFrame({ type: MSG.AUTH_REQUIRED, reason: "not_paired" }));
        } else {
          pendingNonce = crypto.randomBytes(24).toString("base64");
          pendingNonceExpiresAt = Date.now() + 30_000;

          port.write(encodeFrame({
            type: MSG.AUTH_CHALLENGE,
            nonce: pendingNonce,
            expiresInMs: 30_000
          }));
        }
        return;
      }

      // AUTH_RESPONSE
      if (m.type === MSG.AUTH_RESPONSE) {
        if (!clientPubKey) {
          port.write(encodeFrame({ type: MSG.ERROR, error: "hello_required" }));
          return;
        }
        if (!pendingNonce || Date.now() > pendingNonceExpiresAt) {
          port.write(encodeFrame({ type: MSG.AUTH_FAIL, reason: "nonce_expired" }));
          return;
        }

        const ok = verifySignedNonce({
          publicKeyPem: clientPubKey,
          nonce: pendingNonce,
          signatureB64: String(m.signatureB64 ?? "")
        });

        if (!ok) {
          port.write(encodeFrame({ type: MSG.AUTH_FAIL, reason: "bad_signature" }));
          return;
        }

        authed = true;
        pendingNonce = null;
        log(`AUTH_OK for ${clientName}`);

        port.write(encodeFrame({ type: MSG.AUTH_OK, deviceName: DEVICE_NAME }));
        return;
      }

      // PAIR_REQUEST
      if (m.type === MSG.PAIR_REQUEST) {
        if (!clientPubKey) {
          port.write(encodeFrame({ type: MSG.ERROR, error: "hello_required" }));
          return;
        }

        const fp = fingerprintPublicKeyPem(clientPubKey);

        if (PAIRING === "auto") {
          auth.keys[fp] = { name: clientName, addedAt: new Date().toISOString() };
          saveAuth(auth);
          authed = true;
          log(`PAIR_OK for ${clientName} fp=${fp}`);
          port.write(encodeFrame({ type: MSG.PAIR_OK, deviceName: DEVICE_NAME }));
        } else {
          log(`PAIR_DENIED for ${clientName}`);
          port.write(encodeFrame({ type: MSG.PAIR_DENIED }));
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
              exec: { oneShot: true },
              pairing: { mode: PAIRING },
              services: { preAuth: true },
              info: { preAuth: true },
              ping: { preAuth: true }
            }
          };

          port.write(encodeFrame({
            type: MSG.STREAM_DATA,
            streamId,
            b64: Buffer.from(JSON.stringify(servicesPayload)).toString("base64")
          }));

          port.write(encodeFrame({ type: MSG.STREAM_CLOSE, streamId }));
          log(`SERVICES query answered`);
          return;
        }

        // "info" service
        if (serviceName === "info") {
          const infoPayload = {
            type: "info",
            name: DEVICE_NAME,
            version: "0.5.0",
            build: "serial",
            platform: "embedded",
            arch: "arm",
            transport: "serial",
            port: SERIAL_PORT,
            baudRate: BAUD_RATE,
            protocol: 1
          };

          port.write(encodeFrame({
            type: MSG.STREAM_DATA,
            streamId,
            b64: Buffer.from(JSON.stringify(infoPayload)).toString("base64")
          }));

          port.write(encodeFrame({ type: MSG.STREAM_CLOSE, streamId }));
          log(`INFO query answered`);
          return;
        }

        // "ping" service (pre-auth)
        if (serviceName === "ping") {
          const pingPayload = {
            type: "pong",
            time: Date.now(),
            name: DEVICE_NAME
          };

          port.write(encodeFrame({
            type: MSG.STREAM_DATA,
            streamId,
            b64: Buffer.from(JSON.stringify(pingPayload)).toString("base64")
          }));

          port.write(encodeFrame({ type: MSG.STREAM_CLOSE, streamId }));
          log(`PING answered`);
          return;
        }

        // Auth required for other services
        if (!authed) {
          port.write(encodeFrame({
            type: MSG.SERVICE_ERROR,
            streamId,
            error: "auth_required"
          }));
          return;
        }

        port.write(encodeFrame({
          type: MSG.SERVICE_ERROR,
          streamId,
          error: "unknown_service",
          service: serviceName
        }));
        return;
      }

      // EXEC (requires auth)
      if (m.type === MSG.EXEC) {
        if (!authed) {
          port.write(encodeFrame({
            type: MSG.EXEC_RESULT,
            code: 1,
            stdout: "",
            stderr: "Authentication required\n"
          }));
          return;
        }

        const cmd = String(m.cmd ?? "").trim();
        log(`EXEC: ${cmd}`);

        const result = simulateCommand(cmd);
        port.write(encodeFrame({
          type: MSG.EXEC_RESULT,
          code: result.code,
          stdout: result.stdout,
          stderr: result.stderr
        }));
        return;
      }

      // STATUS
      if (m.type === MSG.STATUS) {
        port.write(encodeFrame({
          type: MSG.STATUS_RESULT,
          name: DEVICE_NAME,
          version: "0.5.0",
          transport: "serial",
          uptime: process.uptime(),
          paired: authed
        }));
        return;
      }

    } catch (err) {
      log(`Error handling message: ${err.message}`);
      port.write(encodeFrame({ type: MSG.ERROR, error: "internal_error" }));
    }
  });

  port.on("data", decoder);
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
