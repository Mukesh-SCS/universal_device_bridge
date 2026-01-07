/**
 * @udb/client - Programmatic API for Universal Device Bridge
 * 
 * This module provides a complete API for automating UDB operations.
 * All functions are 100% offline-first and require no cloud services.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dgram from "node:dgram";
import net from "node:net";

import { encodeFrame, createFrameDecoder } from "@udb/protocol/src/framing.js";
import { MSG } from "@udb/protocol/src/messages.js";
import {
  loadOrCreateClientKeypair,
  fingerprintPublicKeyPem,
  signNonce
} from "@udb/protocol/src/crypto.js";

const CONFIG_FILE = path.join(os.homedir(), ".udb", "config.json");

/* ===================== Config Management ===================== */

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

export function getConfig() {
  return readConfig();
}

export function setConfig(cfg) {
  writeConfig(cfg);
}

/* ===================== Errors ===================== */

export class UdbError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "UdbError";
    this.code = code;
    this.details = details;
  }
}

export class AuthError extends UdbError {
  constructor(message) {
    super(message, "AUTH_FAILED");
    this.name = "AuthError";
  }
}

export class ConnectionError extends UdbError {
  constructor(message, details) {
    super(message, "CONNECTION_FAILED", details);
    this.name = "ConnectionError";
  }
}

export class CommandError extends UdbError {
  constructor(message, exitCode) {
    super(message, "COMMAND_FAILED");
    this.code = exitCode;
    this.name = "CommandError";
  }
}

/* ===================== Device Discovery ===================== */

/**
 * Discover devices on the network via UDP broadcast.
 * @param {number} timeoutMs - Timeout in milliseconds (default: 1200)
 * @returns {Promise<Array>} Array of discovered devices
 */
export async function discoverDevices(timeoutMs = 1200) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket("udp4");
    const found = new Map();

    sock.on("message", (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        // Daemon responds with { name, tcpPort, udpPort }
        if (data.tcpPort) {
          const key = `${rinfo.address}:${data.tcpPort}`;
          found.set(key, {
            host: rinfo.address,
            port: data.tcpPort,
            name: data.name || "unknown"
          });
        }
      } catch {}
    });

    sock.bind(() => {
      sock.setBroadcast(true);
      // Send discovery request that daemon expects: "UDB_DISCOVER_V1"
      sock.send(
        Buffer.from("UDB_DISCOVER_V1"),
        9909,
        "255.255.255.255"
      );
    });

    setTimeout(() => {
      sock.close();
      resolve([...found.values()]);
    }, timeoutMs);
  });
}

/* ===================== Target Resolution ===================== */

/**
 * Parse a target string (ip:port or tcp://host:port)
 * @param {string} arg - Target argument
 * @returns {object} Parsed target { host, port }
 */
export function parseTarget(arg) {
  // URL format
  if (arg.startsWith("tcp://")) {
    const u = new URL(arg);
    if (!u.hostname || !u.port) {
      throw new UdbError("Invalid tcp URL. Use: tcp://host:port", "INVALID_TARGET");
    }
    return { host: u.hostname, port: Number(u.port) };
  }

  // ip:port format
  const [host, port] = arg.split(":");
  if (!host || !port) {
    throw new UdbError("Invalid target. Use ip:port or tcp://host:port", "INVALID_TARGET");
  }

  return { host, port: Number(port) };
}

/**
 * Resolve target from explicit arg, current context, last target, or discovery
 * @param {string|object} maybeTarget - Optional explicit target
 * @returns {Promise<object>} Resolved target { host, port }
 */
export async function resolveTarget(maybeTarget) {
  // 1) Explicit target
  if (maybeTarget) {
    if (typeof maybeTarget === "string") {
      return parseTarget(maybeTarget);
    }
    return maybeTarget;
  }

  const cfg = readConfig();

  // 2) Current context
  if (cfg.currentContext) {
    const ctx = cfg.contexts?.[cfg.currentContext];
    if (ctx) {
      return { host: ctx.host, port: ctx.port };
    }
  }

  // 3) Last target
  if (cfg.lastTarget) {
    return cfg.lastTarget;
  }

  // 4) Discovery
  const devices = await discoverDevices();
  if (devices.length === 0) {
    throw new UdbError("No devices found", "NO_DEVICES");
  }
  if (devices.length > 1) {
    throw new UdbError(
      "Multiple devices found. Use explicit target or context",
      "AMBIGUOUS_TARGET"
    );
  }

  return devices[0];
}

/**
 * Test TCP connectivity to a target
 * @param {object} target - Target { host, port }
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<boolean>} True if reachable
 */
export async function probeTcp(target, timeoutMs = 400) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;

    const finish = (ok) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };

    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));

    sock.connect(target.port, target.host);
  });
}

/* ===================== TCP Request Handler ===================== */

/**
 * Send TCP request to device and handle protocol
 * @private
 */
async function tcpRequest(target, messages, options = {}) {
  const {
    onStream = null,
    keepOpen = false,
    preAuth = false,
    timeoutMs = 10000
  } = options;

  const { publicKeyPem } = loadOrCreateClientKeypair();

  return new Promise((resolve, reject) => {
    const sock = net.createConnection(target);
    let sent = false;
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      sock.destroy();
      reject(
        new ConnectionError("Request timeout", {
          target,
          timeoutMs
        })
      );
    }, timeoutMs);

    const sendQueued = () => {
      if (sent) return;
      sent = true;
      for (const m of messages) {
        sock.write(encodeFrame(m));
      }
    };

    const decoder = createFrameDecoder((m) => {
      if (onStream) {
        onStream(m, sock);
      }

      // Handle auth challenge
      if (m.type === MSG.AUTH_CHALLENGE) {
        const { privateKeyPem } = loadOrCreateClientKeypair();
        sock.write(
          encodeFrame({
            type: MSG.AUTH_RESPONSE,
            signatureB64: signNonce({ privateKeyPem, nonce: m.nonce })
          })
        );
        return;
      }

      // Auth succeeded
      if (m.type === MSG.AUTH_OK) {
        sendQueued();
        return;
      }

      // Terminal responses
      const terminalTypes = [
        MSG.EXEC_RESULT,
        MSG.PAIR_OK,
        MSG.PAIR_DENIED,
        MSG.UNPAIR_OK,
        MSG.STATUS_RESULT,
        MSG.LIST_PAIRED_RESULT,
        MSG.AUTH_REQUIRED,
        MSG.AUTH_FAIL,
        MSG.ERROR,
        MSG.PUSH_END,
        MSG.PULL_END,
        MSG.FILE_PUSH_END,
        MSG.FILE_PULL_END,
        MSG.FILE_ERROR
      ];

      if (terminalTypes.includes(m.type)) {
        clearTimeout(timeout);
        resolve({ msg: m });
        if (!keepOpen) sock.end();
      }
    });

    sock.on("connect", () => {
      sock.write(
        encodeFrame({
          type: MSG.HELLO,
          clientName: "udb-client",
          pubKey: publicKeyPem
        })
      );

      if (preAuth) {
        sendQueued();
      }
    });

    sock.on("data", decoder);
    sock.on("error", (err) => {
      clearTimeout(timeout);
      if (!timedOut) {
        reject(
          new ConnectionError(err.message, {
            target,
            originalError: err.code
          })
        );
      }
    });
  });
}

/* ===================== Core Operations ===================== */

/**
 * Get device status
 * @param {object} target - Target { host, port }
 * @returns {Promise<object>} Status object
 */
export async function status(target) {
  target = typeof target === "string" ? parseTarget(target) : target;

  const res = await tcpRequest(target, [{ type: MSG.STATUS }]);

  if (res.msg?.type === MSG.STATUS_RESULT) {
    return {
      name: res.msg.deviceName,
      pairingMode: res.msg.pairingMode,
      execEnabled: res.msg.execEnabled,
      pairedCount: res.msg.pairedCount
    };
  }

  if (res.msg?.type === MSG.AUTH_REQUIRED) {
    throw new AuthError("Device requires pairing");
  }

  if (res.msg?.type === MSG.ERROR) {
    throw new UdbError(res.msg.error, "DEVICE_ERROR");
  }

  throw new UdbError("Unexpected response", "PROTOCOL_ERROR");
}

/**
 * Pair with a device
 * @param {object} target - Target { host, port }
 * @returns {Promise<object>} Pair result with fingerprint
 */
export async function pair(target) {
  target = typeof target === "string" ? parseTarget(target) : target;

  const { publicKeyPem } = loadOrCreateClientKeypair();
  const fp = fingerprintPublicKeyPem(publicKeyPem);

  const res = await tcpRequest(target, [{ type: MSG.PAIR_REQUEST }], {
    preAuth: true
  });

  if (res.msg?.type === MSG.PAIR_OK) {
    return { fingerprint: fp, paired: true };
  }

  if (res.msg?.type === MSG.PAIR_DENIED) {
    throw new AuthError("Pairing denied by device");
  }

  if (res.msg?.type === MSG.ERROR) {
    throw new UdbError(res.msg.error, "DEVICE_ERROR");
  }

  throw new UdbError("Unexpected response", "PROTOCOL_ERROR");
}

/**
 * Unpair from a device
 * @param {object} target - Target { host, port }
 * @param {object} options - { all: bool, fingerprint: string }
 * @returns {Promise<object>} Unpair result
 */
export async function unpair(target, options = {}) {
  target = typeof target === "string" ? parseTarget(target) : target;

  const payload = { type: MSG.UNPAIR_REQUEST };

  if (options.all) payload.all = true;
  if (options.fingerprint) payload.fp = options.fingerprint;

  if (payload.all && payload.fp) {
    throw new UdbError("Cannot use both 'all' and 'fingerprint'", "INVALID_ARGS");
  }

  const res = await tcpRequest(target, [payload]);

  if (res.msg?.type === MSG.UNPAIR_OK) {
    return {
      scope: res.msg.scope,
      removed: res.msg.removed,
      fingerprint: res.msg.fp
    };
  }

  if (res.msg?.type === MSG.AUTH_REQUIRED) {
    throw new AuthError("Not authorized to unpair");
  }

  if (res.msg?.type === MSG.ERROR) {
    throw new UdbError(res.msg.error, "DEVICE_ERROR");
  }

  throw new UdbError("Unexpected response", "PROTOCOL_ERROR");
}

/**
 * List paired clients on device
 * @param {object} target - Target { host, port }
 * @returns {Promise<Array>} Array of paired clients
 */
export async function listPaired(target) {
  target = typeof target === "string" ? parseTarget(target) : target;

  const res = await tcpRequest(target, [{ type: MSG.LIST_PAIRED }]);

  if (res.msg?.type === MSG.LIST_PAIRED_RESULT) {
    return res.msg.devices || [];
  }

  if (res.msg?.type === MSG.AUTH_REQUIRED) {
    throw new AuthError("Not authorized");
  }

  if (res.msg?.type === MSG.ERROR) {
    throw new UdbError(res.msg.error, "DEVICE_ERROR");
  }

  throw new UdbError("Unexpected response", "PROTOCOL_ERROR");
}

/**
 * Execute a command on device
 * @param {object} target - Target { host, port }
 * @param {string} command - Command to execute
 * @returns {Promise<object>} Result { stdout, stderr, exitCode }
 */
export async function exec(target, command) {
  target = typeof target === "string" ? parseTarget(target) : target;

  if (!command || typeof command !== "string") {
    throw new UdbError("Command must be a non-empty string", "INVALID_ARGS");
  }

  const res = await tcpRequest(target, [{ type: MSG.EXEC, cmd: command }]);

  if (res.msg?.type === MSG.EXEC_RESULT) {
    const result = {
      stdout: res.msg.stdout || "",
      stderr: res.msg.stderr || "",
      exitCode: res.msg.code ?? 0
    };

    if (result.exitCode !== 0) {
      throw new CommandError(
        `Command failed: ${command}`,
        result.exitCode
      );
    }

    return result;
  }

  if (res.msg?.type === MSG.AUTH_REQUIRED) {
    throw new AuthError("Not authorized");
  }

  if (res.msg?.type === MSG.ERROR) {
    throw new UdbError(res.msg.error, "DEVICE_ERROR");
  }

  throw new UdbError("Unexpected response", "PROTOCOL_ERROR");
}

/* ===================== Context Management ===================== */

/**
 * Get all contexts
 * @returns {object} Contexts map
 */
export function getContexts() {
  const cfg = readConfig();
  return cfg.contexts || {};
}

/**
 * Get current context name
 * @returns {string|null} Current context name
 */
export function getCurrentContextName() {
  const cfg = readConfig();
  return cfg.currentContext || null;
}

/**
 * Set current context
 * @param {string} name - Context name
 */
export function setCurrentContext(name) {
  const cfg = readConfig();
  if (!cfg.contexts || !cfg.contexts[name]) {
    throw new UdbError(`No such context: ${name}`, "CONTEXT_NOT_FOUND");
  }
  cfg.currentContext = name;
  writeConfig(cfg);
}

/**
 * Add a context
 * @param {string} name - Context name
 * @param {object} target - Target { host, port, name? }
 */
export function addContext(name, target) {
  const cfg = readConfig();
  cfg.contexts = cfg.contexts || {};
  cfg.contexts[name] = target;
  writeConfig(cfg);
}

/**
 * Get context by name
 * @param {string} name - Context name
 * @returns {object|null} Context or null
 */
export function getContext(name) {
  const contexts = getContexts();
  return contexts[name] || null;
}

/**
 * Remove a context
 * @param {string} name - Context name
 */
export function removeContext(name) {
  const cfg = readConfig();
  if (cfg.contexts) {
    delete cfg.contexts[name];
    if (cfg.currentContext === name) {
      delete cfg.currentContext;
    }
    writeConfig(cfg);
  }
}

/* ===================== Session Abstraction ===================== */

/**
 * Create a persistent session for multiple operations
 * @param {object} target - Target { host, port }
 * @returns {Promise<UdbSession>} Session object
 */
export async function createSession(target) {
  target = typeof target === "string" ? parseTarget(target) : target;

  const session = new UdbSession(target);
  await session.connect();
  return session;
}

export class UdbSession {
  constructor(target) {
    this.target = target;
    this.socket = null;
    this.decoder = null;
    this.authenticated = false;
    this.pendingCallbacks = new Map();
    this.callId = 0;
  }

  /**
   * Connect and authenticate
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const { publicKeyPem } = loadOrCreateClientKeypair();

      this.socket = net.createConnection(this.target);

      this.decoder = createFrameDecoder((m) => {
        if (m.type === MSG.AUTH_CHALLENGE) {
          const { privateKeyPem } = loadOrCreateClientKeypair();
          this.socket.write(
            encodeFrame({
              type: MSG.AUTH_RESPONSE,
              signatureB64: signNonce({ privateKeyPem, nonce: m.nonce })
            })
          );
          return;
        }

        if (m.type === MSG.AUTH_OK) {
          this.authenticated = true;
          resolve();
          return;
        }

        // Route message to pending callback
        const cb = this.pendingCallbacks.get(m.callId || "default");
        if (cb) {
          this.pendingCallbacks.delete(m.callId || "default");
          cb(m);
        }
      });

      this.socket.on("data", this.decoder);
      this.socket.on("error", (err) => {
        reject(new ConnectionError(err.message));
      });

      this.socket.on("connect", () => {
        this.socket.write(
          encodeFrame({
            type: MSG.HELLO,
            clientName: "udb-client-session",
            pubKey: publicKeyPem
          })
        );
      });
    });
  }

  /**
   * Send request and wait for response
   */
  async _request(messages, options = {}) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new ConnectionError("Session timeout"));
      }, options.timeoutMs || 10000);

      const cb = (msg) => {
        clearTimeout(timeoutId);
        resolve({ msg });
      };

      this.pendingCallbacks.set("default", cb);

      for (const m of messages) {
        this.socket.write(encodeFrame(m));
      }
    });
  }

  /**
   * Execute command in session
   */
  async exec(command) {
    if (!this.authenticated) {
      throw new UdbError("Session not authenticated", "NOT_CONNECTED");
    }

    const res = await this._request([{ type: MSG.EXEC, cmd: command }]);

    if (res.msg?.type === MSG.EXEC_RESULT) {
      return {
        stdout: res.msg.stdout || "",
        stderr: res.msg.stderr || "",
        exitCode: res.msg.code ?? 0
      };
    }

    if (res.msg?.type === MSG.ERROR) {
      throw new UdbError(res.msg.error, "DEVICE_ERROR");
    }

    throw new UdbError("Unexpected response", "PROTOCOL_ERROR");
  }

  /**
   * Get status in session
   */
  async status() {
    if (!this.authenticated) {
      throw new UdbError("Session not authenticated", "NOT_CONNECTED");
    }

    const res = await this._request([{ type: MSG.STATUS }]);

    if (res.msg?.type === MSG.STATUS_RESULT) {
      return {
        name: res.msg.deviceName,
        pairingMode: res.msg.pairingMode,
        execEnabled: res.msg.execEnabled,
        pairedCount: res.msg.pairedCount
      };
    }

    throw new UdbError("Unexpected response", "PROTOCOL_ERROR");
  }

  /**
   * Close session
   */
  async close() {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
      this.authenticated = false;
    }
  }
}

/* ===================== Batch Operations ===================== */

/**
 * Execute command on multiple devices
 * @param {Array<object>} targets - Array of target objects
 * @param {string} command - Command to execute
 * @param {object} options - { stopOnError: bool, parallel: bool }
 * @returns {Promise<Array>} Results array
 */
export async function execBatch(targets, command, options = {}) {
  const { stopOnError = false, parallel = true } = options;

  if (!Array.isArray(targets) || targets.length === 0) {
    throw new UdbError("targets must be non-empty array", "INVALID_ARGS");
  }

  const results = [];

  if (parallel) {
    const promises = targets.map(async (target) => {
      try {
        const result = await exec(target, command);
        return { target, success: true, result };
      } catch (err) {
        return { target, success: false, error: err };
      }
    });

    const settled = await Promise.allSettled(promises);

    for (const res of settled) {
      if (res.status === "fulfilled") {
        results.push(res.value);
        if (!res.value.success && stopOnError) {
          throw new UdbError("Batch operation stopped", "BATCH_FAILED");
        }
      } else {
        results.push({
          success: false,
          error: res.reason
        });
        if (stopOnError) {
          throw new UdbError("Batch operation stopped", "BATCH_FAILED");
        }
      }
    }
  } else {
    for (const target of targets) {
      try {
        const result = await exec(target, command);
        results.push({ target, success: true, result });
      } catch (err) {
        results.push({ target, success: false, error: err });
        if (stopOnError) {
          throw new UdbError("Batch operation stopped", "BATCH_FAILED");
        }
      }
    }
  }

  return results;
}

/* ===================== Exports ===================== */

export default {
  discoverDevices,
  parseTarget,
  resolveTarget,
  probeTcp,
  status,
  pair,
  unpair,
  listPaired,
  exec,
  getContexts,
  getCurrentContextName,
  setCurrentContext,
  addContext,
  getContext,
  removeContext,
  createSession,
  UdbSession,
  execBatch,
  UdbError,
  AuthError,
  ConnectionError,
  CommandError,
  getConfig,
  setConfig
};
