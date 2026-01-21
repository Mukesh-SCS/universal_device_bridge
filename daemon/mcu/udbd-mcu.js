/**
 * UDB MCU Daemon (Lightweight)
 * 
 * A minimal UDB daemon designed for microcontrollers and resource-constrained
 * embedded devices. This implementation prioritizes:
 * 
 * - Minimal memory footprint
 * - No external dependencies (except protocol)
 * - Single-connection model
 * - Essential operations only
 * 
 * Supported operations:
 * - Authentication and pairing
 * - Command execution
 * - Status queries
 * - File push (to memory buffer)
 * 
 * Usage:
 *   node udbd-mcu.js [options]
 * 
 * Options:
 *   --name <name>      Device name (default: mcu-device)
 *   --tcp <port>       TCP port (default: 9910)
 *   --pairing <mode>   Pairing mode: auto|manual (default: auto)
 *   --exec <handler>   Custom exec handler script
 */

import net from "node:net";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* ===================== Minimal Protocol Implementation ===================== */

// Message types (subset of full protocol)
const MSG = {
  HELLO: "hello",
  AUTH_REQUIRED: "auth_required",
  AUTH_CHALLENGE: "auth_challenge",
  AUTH_RESPONSE: "auth_response",
  AUTH_OK: "auth_ok",
  AUTH_FAIL: "auth_fail",
  PAIR_REQUEST: "pair_request",
  PAIR_OK: "pair_ok",
  PAIR_DENIED: "pair_denied",
  UNPAIR_REQUEST: "unpair_request",
  UNPAIR_OK: "unpair_ok",
  EXEC: "exec",
  EXEC_RESULT: "exec_result",
  STATUS: "status",
  STATUS_RESULT: "status_result",
  ERROR: "error"
};

// Minimal frame encoder
function encodeFrame(obj) {
  const payload = Buffer.from(JSON.stringify(obj), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32BE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

// Minimal frame decoder (single frame at a time)
function createFrameDecoder(onMessage) {
  let buf = Buffer.alloc(0);

  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);

    while (buf.length >= 4) {
      const len = buf.readUInt32BE(0);

      // Limit frame size for MCU
      if (len <= 0 || len > 64 * 1024) {
        onMessage({ type: "error", error: "frame_too_large" });
        buf = Buffer.alloc(0);
        return;
      }

      if (buf.length < 4 + len) return;

      const payload = buf.slice(4, 4 + len).toString("utf8");
      buf = buf.slice(4 + len);

      try {
        onMessage(JSON.parse(payload));
      } catch {
        onMessage({ type: "error", error: "invalid_json" });
      }
    }
  };
}

// Minimal crypto functions
function fingerprintPublicKey(pubKeyPem) {
  const pubKey = crypto.createPublicKey(pubKeyPem);
  const der = pubKey.export({ type: "spki", format: "der" });
  const hash = crypto.createHash("sha256").update(der).digest("hex");
  return hash.slice(0, 16);
}

function verifySignature(pubKeyPem, nonce, signatureB64) {
  try {
    const pubKey = crypto.createPublicKey(pubKeyPem);
    const sig = Buffer.from(signatureB64, "base64");
    return crypto.verify(null, Buffer.from(nonce, "utf8"), pubKey, sig);
  } catch {
    return false;
  }
}

/* ===================== Configuration ===================== */

const args = process.argv.slice(2);

function getArg(name, def) {
  const idx = args.indexOf(name);
  if (idx === -1) return def;
  return args[idx + 1] ?? def;
}

const TCP_PORT = Number(getArg("--tcp", "9910"));
const PAIRING = getArg("--pairing", "auto");
const DEVICE_NAME = getArg("--name", "mcu-device");
const EXEC_HANDLER = getArg("--exec", null);

/* ===================== State (Minimal) ===================== */

const stateDir = path.join(os.homedir(), ".udbd-mcu");
if (!fs.existsSync(stateDir)) {
  fs.mkdirSync(stateDir, { recursive: true });
}

const authPath = path.join(stateDir, "authorized_keys.json");

// Simple auth storage (optimized for MCU with limited keys)
let authorizedKeys = {};

function loadAuth() {
  try {
    if (fs.existsSync(authPath)) {
      authorizedKeys = JSON.parse(fs.readFileSync(authPath, "utf8"));
    }
  } catch {
    authorizedKeys = {};
  }
}

function saveAuth() {
  fs.writeFileSync(authPath, JSON.stringify(authorizedKeys, null, 2));
}

function isAuthorized(fingerprint) {
  return Boolean(authorizedKeys[fingerprint]);
}

function addAuthorized(fingerprint, name) {
  authorizedKeys[fingerprint] = { name, addedAt: new Date().toISOString() };
  saveAuth();
}

function removeAuthorized(fingerprint) {
  if (authorizedKeys[fingerprint]) {
    delete authorizedKeys[fingerprint];
    saveAuth();
    return true;
  }
  return false;
}

loadAuth();

/* ===================== Command Execution ===================== */

// Built-in commands for MCU
const builtinCommands = {
  "help": () => ({
    stdout: "Available commands: help, info, uptime, memory, gpio, reboot\n",
    stderr: "",
    code: 0
  }),
  
  "info": () => ({
    stdout: `Device: ${DEVICE_NAME}\nType: MCU\nFirmware: 1.0.0\nProtocol: UDB/1.0\n`,
    stderr: "",
    code: 0
  }),
  
  "uptime": () => ({
    stdout: `${Math.floor(process.uptime())} seconds\n`,
    stderr: "",
    code: 0
  }),
  
  "memory": () => {
    const used = process.memoryUsage();
    return {
      stdout: `Heap: ${Math.round(used.heapUsed / 1024)}KB / ${Math.round(used.heapTotal / 1024)}KB\n`,
      stderr: "",
      code: 0
    };
  },
  
  "gpio": () => ({
    stdout: "GPIO simulation: All pins LOW\n",
    stderr: "",
    code: 0
  }),
  
  "reboot": () => ({
    stdout: "Reboot scheduled (simulated)\n",
    stderr: "",
    code: 0
  })
};

function executeCommand(cmd) {
  const trimmed = cmd.trim().toLowerCase();
  
  // Check built-in commands
  if (builtinCommands[trimmed]) {
    return builtinCommands[trimmed]();
  }
  
  // Check for custom exec handler
  if (EXEC_HANDLER && fs.existsSync(EXEC_HANDLER)) {
    try {
      const handler = require(EXEC_HANDLER);
      if (typeof handler.exec === "function") {
        return handler.exec(cmd);
      }
    } catch (e) {
      return {
        stdout: "",
        stderr: `Exec handler error: ${e.message}\n`,
        code: 1
      };
    }
  }
  
  // Default: command not found
  return {
    stdout: "",
    stderr: `Unknown command: ${cmd.split(" ")[0]}\nType 'help' for available commands.\n`,
    code: 127
  };
}

/* ===================== Logging ===================== */

function log(msg) {
  console.log(`[MCU ${new Date().toISOString()}] ${msg}`);
}

/* ===================== TCP Server (Single Connection) ===================== */

let activeConnection = null;

const server = net.createServer((socket) => {
  // MCU model: single connection only
  if (activeConnection) {
    log("Rejecting connection - already have active client");
    socket.write(encodeFrame({ type: MSG.ERROR, error: "busy" }));
    socket.end();
    return;
  }

  activeConnection = socket;
  socket.setNoDelay(true);

  let clientPubKey = null;
  let clientName = "unknown";
  let clientFingerprint = null;
  let authed = false;
  let pendingNonce = null;

  log(`Connection from ${socket.remoteAddress}`);

  const decoder = createFrameDecoder((m) => {
    try {
      if (m?.type === "error") {
        socket.write(encodeFrame({ type: MSG.ERROR, error: m.error }));
        return;
      }

      // HELLO
      if (m.type === MSG.HELLO) {
        clientName = m.clientName ?? "unknown";
        clientPubKey = m.pubKey;

        // Protocol version negotiation (Phase 4)
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

        clientFingerprint = fingerprintPublicKey(clientPubKey);
        log(`HELLO from ${clientName} fp=${clientFingerprint}`);

        if (!isAuthorized(clientFingerprint)) {
          socket.write(encodeFrame({ type: MSG.AUTH_REQUIRED }));
        } else {
          pendingNonce = crypto.randomBytes(16).toString("base64");
          socket.write(encodeFrame({ type: MSG.AUTH_CHALLENGE, nonce: pendingNonce }));
        }
        return;
      }

      // AUTH_RESPONSE
      if (m.type === MSG.AUTH_RESPONSE) {
        if (!pendingNonce || !clientPubKey) {
          socket.write(encodeFrame({ type: MSG.AUTH_FAIL }));
          return;
        }

        const valid = verifySignature(clientPubKey, pendingNonce, m.signatureB64 || "");
        pendingNonce = null;

        if (!valid) {
          socket.write(encodeFrame({ type: MSG.AUTH_FAIL }));
          return;
        }

        authed = true;
        log(`AUTH_OK for ${clientName}`);
        socket.write(encodeFrame({ type: MSG.AUTH_OK, deviceName: DEVICE_NAME }));
        return;
      }

      // PAIR_REQUEST
      if (m.type === MSG.PAIR_REQUEST) {
        if (!clientFingerprint) {
          socket.write(encodeFrame({ type: MSG.ERROR, error: "hello_required" }));
          return;
        }

        if (PAIRING === "auto") {
          addAuthorized(clientFingerprint, clientName);
          authed = true;
          log(`PAIRED ${clientName} fp=${clientFingerprint}`);
          socket.write(encodeFrame({ type: MSG.PAIR_OK, deviceName: DEVICE_NAME }));
        } else {
          log(`PAIR_DENIED for ${clientName} (manual mode)`);
          socket.write(encodeFrame({ type: MSG.PAIR_DENIED }));
        }
        return;
      }

      // Require auth for remaining operations
      if (!authed) {
        socket.write(encodeFrame({ type: MSG.AUTH_REQUIRED }));
        return;
      }

      // UNPAIR_REQUEST
      if (m.type === MSG.UNPAIR_REQUEST) {
        if (m.all) {
          const count = Object.keys(authorizedKeys).length;
          authorizedKeys = {};
          saveAuth();
          authed = false;
          socket.write(encodeFrame({ type: MSG.UNPAIR_OK, removed: count }));
        } else {
          const fp = m.fp || clientFingerprint;
          const removed = removeAuthorized(fp);
          if (fp === clientFingerprint) authed = false;
          socket.write(encodeFrame({ type: MSG.UNPAIR_OK, removed, fp }));
        }
        return;
      }

      // STATUS
      if (m.type === MSG.STATUS) {
        socket.write(encodeFrame({
          type: MSG.STATUS_RESULT,
          deviceName: DEVICE_NAME,
          deviceType: "mcu",
          execEnabled: true,
          pairingMode: PAIRING,
          pairedCount: Object.keys(authorizedKeys).length,
          uptime: Math.floor(process.uptime()),
          memory: process.memoryUsage().heapUsed
        }));
        return;
      }

      // EXEC
      if (m.type === MSG.EXEC) {
        const cmd = String(m.cmd ?? "").trim();
        log(`EXEC: ${cmd}`);

        if (!cmd) {
          socket.write(encodeFrame({ type: MSG.EXEC_RESULT, code: 1, stdout: "", stderr: "empty command" }));
          return;
        }

        const result = executeCommand(cmd);
        socket.write(encodeFrame({
          type: MSG.EXEC_RESULT,
          code: result.code,
          stdout: result.stdout,
          stderr: result.stderr
        }));
        return;
      }

      // Unknown message
      socket.write(encodeFrame({ type: MSG.ERROR, error: "unknown_message" }));

    } catch (e) {
      log(`Error: ${e.message}`);
      socket.write(encodeFrame({ type: MSG.ERROR, error: "internal_error" }));
    }
  });

  socket.on("data", decoder);
  
  socket.on("error", (e) => {
    if (e.code !== "ECONNRESET") {
      log(`Socket error: ${e.message}`);
    }
  });

  socket.on("close", () => {
    log(`Connection closed`);
    activeConnection = null;
  });
});

server.listen(TCP_PORT, "0.0.0.0", () => {
  log(`MCU Daemon listening on :${TCP_PORT}`);
  log(`Device: ${DEVICE_NAME}`);
  log(`Pairing: ${PAIRING}`);
  log(`State: ${stateDir}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  log("Shutting down...");
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  log("Shutting down...");
  server.close();
  process.exit(0);
});
