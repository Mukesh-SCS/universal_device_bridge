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

// Transport layer
import { TcpTransport, createTcpTransport, SerialTransport, createSerialTransport, parseSerialTarget } from "./transport/index.js";

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
 * @param {Object} target - Target with host and port
 * @param {Array} messages - Messages to send after auth
 * @param {Object} options - Request options
 * @param {Transport} [options.transport] - Optional transport (defaults to TcpTransport)
 */
async function tcpRequest(target, messages, options = {}) {
  const {
    onStream = null,
    keepOpen = false,
    preAuth = false,
    timeoutMs = 10000,
    ignoreTerminalTypes = [],  // Types to ignore as terminal (e.g., AUTH_REQUIRED during pairing)
    transport = null           // Optional custom transport
  } = options;

  const { publicKeyPem } = loadOrCreateClientKeypair();

  // Use provided transport or create TcpTransport
  const sock = transport || createTcpTransport(target, { timeout: timeoutMs });

  return new Promise(async (resolve, reject) => {
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
        MSG.FILE_ERROR,
        MSG.STREAM_DATA,      // For service queries
        MSG.STREAM_CLOSE,     // For service stream end
        MSG.SERVICE_ERROR     // For service errors
      ];

      // Skip ignored terminal types (they're informational, not final)
      if (ignoreTerminalTypes.includes(m.type)) {
        return;
      }

      if (terminalTypes.includes(m.type)) {
        clearTimeout(timeout);
        resolve({ msg: m });
        if (!keepOpen) sock.end();
      }
    });

    // Set up transport callbacks
    sock.onData(decoder);
    sock.onError((err) => {
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

    // Connect and send HELLO
    try {
      await sock.connect();
      
      sock.write(
        encodeFrame({
          type: MSG.HELLO,
          clientName: "udb-client",
          pubKey: publicKeyPem,
          protocol: 1
        })
      );

      if (preAuth) {
        sendQueued();
      }
    } catch (err) {
      clearTimeout(timeout);
      reject(
        new ConnectionError(err.message, {
          target,
          originalError: err.code || err.message
        })
      );
    }
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
 * Get device services/capabilities (pre-auth allowed)
 * @param {object} target - Target { host, port }
 * @returns {Promise<object>} Services object with capabilities
 */
export async function getServices(target) {
  target = typeof target === "string" ? parseTarget(target) : target;

  const { publicKeyPem } = loadOrCreateClientKeypair();
  const streamId = Math.floor(Math.random() * 1000000);

  const res = await tcpRequest(target, [{ 
    type: MSG.OPEN_SERVICE, 
    service: "services",
    streamId 
  }], {
    preAuth: true,
    ignoreTerminalTypes: [MSG.AUTH_REQUIRED]
  });

  if (res.msg?.type === MSG.STREAM_DATA) {
    try {
      const data = Buffer.from(res.msg.b64 || "", "base64").toString("utf8");
      return JSON.parse(data);
    } catch {
      throw new UdbError("Failed to parse services response", "PROTOCOL_ERROR");
    }
  }

  if (res.msg?.type === MSG.SERVICE_ERROR) {
    throw new UdbError(res.msg.error || "Service error", "SERVICE_ERROR");
  }

  throw new UdbError("Unexpected response", "PROTOCOL_ERROR");
}

/**
 * Get device info/metadata (pre-auth allowed)
 * @param {object} target - Target { host, port }
 * @returns {Promise<object>} Info object with daemon metadata
 */
export async function getInfo(target) {
  target = typeof target === "string" ? parseTarget(target) : target;

  const { publicKeyPem } = loadOrCreateClientKeypair();
  const streamId = Math.floor(Math.random() * 1000000);

  const res = await tcpRequest(target, [{ 
    type: MSG.OPEN_SERVICE, 
    service: "info",
    streamId 
  }], {
    preAuth: true,
    ignoreTerminalTypes: [MSG.AUTH_REQUIRED]
  });

  if (res.msg?.type === MSG.STREAM_DATA) {
    try {
      const data = Buffer.from(res.msg.b64 || "", "base64").toString("utf8");
      return JSON.parse(data);
    } catch {
      throw new UdbError("Failed to parse info response", "PROTOCOL_ERROR");
    }
  }

  if (res.msg?.type === MSG.SERVICE_ERROR) {
    throw new UdbError(res.msg.error || "Service error", "SERVICE_ERROR");
  }

  throw new UdbError("Unexpected response", "PROTOCOL_ERROR");
}

/**
 * Ping a device for health check (pre-auth)
 * Returns latency and device info
 * @param {object|string} target - Target { host, port } or string
 * @returns {Promise<object>} Ping result { pong, latencyMs, name, uptime }
 */
export async function ping(target) {
  target = typeof target === "string" ? parseTarget(target) : target;

  const streamId = Math.floor(Math.random() * 1000000);
  const start = Date.now();

  const res = await tcpRequest(target, [{ 
    type: MSG.OPEN_SERVICE, 
    service: "ping",
    streamId 
  }], {
    preAuth: true,
    ignoreTerminalTypes: [MSG.AUTH_REQUIRED]
  });

  const latencyMs = Date.now() - start;

  if (res.msg?.type === MSG.STREAM_DATA) {
    try {
      const data = Buffer.from(res.msg.b64 || "", "base64").toString("utf8");
      const payload = JSON.parse(data);
      return {
        pong: true,
        latencyMs,
        name: payload.name,
        uptime: payload.uptime,
        time: payload.time
      };
    } catch {
      throw new UdbError("Failed to parse ping response", "PROTOCOL_ERROR");
    }
  }

  if (res.msg?.type === MSG.SERVICE_ERROR) {
    throw new UdbError(res.msg.error || "Service error", "SERVICE_ERROR");
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
    preAuth: true,
    ignoreTerminalTypes: [MSG.AUTH_REQUIRED]  // Ignore AUTH_REQUIRED during pairing flow
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

/* ===================== Stream Abstraction ===================== */

/**
 * Represents a bidirectional stream within a service
 * Implements EventEmitter-like interface for data/close/error events
 */
class Stream {
  constructor(session, streamId, serviceName) {
    this.session = session;
    this.streamId = streamId;
    this.serviceName = serviceName;
    this.closed = false;
    this.listeners = {
      data: [],
      close: [],
      error: []
    };
  }

  /**
   * Write data to stream
   */
  write(data) {
    if (this.closed) {
      throw new UdbError("Stream is closed", "STREAM_CLOSED");
    }

    // Always convert to base64 for transmission
    const b64Data = typeof data === "string" 
      ? Buffer.from(data).toString("base64") 
      : Buffer.isBuffer(data)
        ? data.toString("base64")
        : Buffer.from(String(data)).toString("base64");
    
    this.session.socket.write(
      encodeFrame({
        type: MSG.STREAM_DATA,
        streamId: this.streamId,
        b64: b64Data
      })
    );
  }

  /**
   * Resize terminal stream
   */
  resize(cols, rows) {
    if (this.closed) {
      throw new UdbError("Stream is closed", "STREAM_CLOSED");
    }

    this.session.socket.write(
      encodeFrame({
        type: MSG.STREAM_RESIZE,
        streamId: this.streamId,
        cols,
        rows
      })
    );
  }

  /**
   * Close stream
   */
  close() {
    if (!this.closed) {
      this.closed = true;
      this.session.socket.write(
        encodeFrame({
          type: MSG.STREAM_CLOSE,
          streamId: this.streamId
        })
      );
    }
  }

  /**
   * Register listener for stream event
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return this;
  }

  /**
   * Remove listener
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
    return this;
  }

  /**
   * Emit event to all listeners
   */
  _emit(event, ...args) {
    if (this.listeners[event]) {
      for (const cb of this.listeners[event]) {
        cb(...args);
      }
    }
  }

  /**
   * Data received on stream
   */
  _onData(b64Data) {
    const data = Buffer.from(b64Data || "", "base64");
    this._emit("data", data);
  }

  /**
   * Stream closed by remote
   */
  _onClose() {
    if (!this.closed) {
      this.closed = true;
      this._emit("close");
    }
  }

  /**
   * Error on stream
   */
  _onError(message) {
    this._emit("error", new UdbError(message, "STREAM_ERROR"));
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
    this.messageQueue = []; // Queue for messages not immediately claimed
    this.callId = 0;
    this.openStreams = new Map(); // Map<streamId, Stream>
    this.nextStreamId = 1;
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

        // Route stream messages by streamId
        if (m.streamId) {
          const stream = this.openStreams.get(m.streamId);
          if (stream) {
            if (m.type === MSG.STREAM_DATA) {
              stream._onData(m.b64);
            } else if (m.type === MSG.STREAM_CLOSE) {
              stream._onClose();
              this.openStreams.delete(m.streamId);
            } else if (m.type === MSG.SERVICE_ERROR) {
              stream._onError(m.error || "Stream error");
              this.openStreams.delete(m.streamId);
            }
          }
          return;
        }

        // Route message to pending callback or queue it
        const cb = this.pendingCallbacks.get(m.callId || "default");
        if (cb) {
          // Don't delete - let callback decide if it wants more messages
          cb(m);
        } else {
          // No one waiting - queue the message
          this.messageQueue.push(m);
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
            pubKey: publicKeyPem,
            protocol: 1
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
        this.pendingCallbacks.delete("default");
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

  /**
   * Open a named service on the device, returning a stream
   * @param {string} serviceName - Name of service (e.g., "shell", "exec", "logs")
   * @param {object} options - Service options (e.g., {pty: true, cols: 80, rows: 24})
   * @returns {Promise<Stream>} Stream object for bidirectional communication
   */
  async openService(serviceName, options = {}) {
    if (!this.authenticated) {
      throw new UdbError("Session not authenticated", "NOT_CONNECTED");
    }

    const streamId = this.nextStreamId++;
    const stream = new Stream(this, streamId, serviceName);
    this.openStreams.set(streamId, stream);

    // Send OPEN_SERVICE message to daemon
    this.socket.write(
      encodeFrame({
        type: MSG.OPEN_SERVICE,
        streamId,
        service: serviceName,
        ...options
      })
    );

    // Wait for the stream to be acknowledged (either STREAM_DATA or SERVICE_ERROR)
    // For now, just return the stream and let the daemon establish it
    return stream;
  }

  /**
   * Send message and wait for response (next message from server)
   */
  async sendMessage(message, options = {}) {
    if (!this.authenticated) {
      throw new UdbError("Session not authenticated", "NOT_CONNECTED");
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingCallbacks.delete("default");
        reject(new ConnectionError("Message timeout"));
      }, options.timeoutMs || 30000);

      // Check if there's a queued message first
      if (this.messageQueue.length > 0) {
        const queued = this.messageQueue.shift();
        clearTimeout(timeoutId);
        return resolve(queued);
      }

      const cb = (msg) => {
        clearTimeout(timeoutId);
        this.pendingCallbacks.delete("default");
        resolve(msg);
      };

      this.pendingCallbacks.set("default", cb);
      this.socket.write(encodeFrame(message));
    });
  }

  /**
   * Wait for message of specific type(s)
   */
  async waitForMessage(types, timeoutMs = 10000) {
    if (!Array.isArray(types)) {
      types = [types];
    }

    // Check if message is already queued
    for (let i = 0; i < this.messageQueue.length; i++) {
      if (types.includes(this.messageQueue[i].type)) {
        return this.messageQueue.splice(i, 1)[0];
      }
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingCallbacks.delete("default");
        reject(new ConnectionError("Wait timeout"));
      }, timeoutMs);

      const cb = (msg) => {
        if (types.includes(msg.type)) {
          clearTimeout(timeoutId);
          this.pendingCallbacks.delete("default");
          resolve(msg);
        }
        // If not matching type, re-queue it for later
        else {
          this.messageQueue.push(msg);
        }
      };

      this.pendingCallbacks.set("default", cb);
    });
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

/* ===================== File Transfer (Push/Pull) ===================== */

/**
 * Push a file to a device
 * @param {string|object} target - Device target (ip:port or parsed target)
 * @param {string} localPath - Path to local file to send
 * @param {string} remotePath - Path where file will be saved on device
 * @param {object} options - Options (session, timeout)
 * @returns {Promise<{success: boolean, bytes: number}>}
 */
export async function push(target, localPath, remotePath, options = {}) {
  const parsed = parseTarget(target);
  const session = options.session || (await createSession(parsed));
  
  try {
    // Check if local file exists
    if (!fs.existsSync(localPath)) {
      throw new UdbError(`Local file not found: ${localPath}`, "FILE_NOT_FOUND");
    }

    const fileStats = fs.statSync(localPath);
    const fileSize = fileStats.size;

    // Send PUSH_BEGIN
    const pushBegin = await session.sendMessage({
      type: MSG.PUSH_BEGIN,
      remotePath: remotePath
    });

    if (pushBegin.type === MSG.ERROR) {
      throw new UdbError(pushBegin.error || "Device rejected push", "PUSH_REJECTED");
    }

    if (pushBegin.type !== "push_ready") {
      throw new UdbError(`Unexpected response: ${pushBegin.type}`, "PROTOCOL_ERROR");
    }

    // Read and send file in chunks
    const chunkSize = 64 * 1024; // 64KB chunks
    const buffer = Buffer.alloc(chunkSize);
    const fileHandle = fs.openSync(localPath, "r");
    
    let bytesRead = 0;
    let totalRead = 0;

    try {
      while ((bytesRead = fs.readSync(fileHandle, buffer, 0, chunkSize)) > 0) {
        const chunk = buffer.slice(0, bytesRead);
        const pushChunk = await session.sendMessage({
          type: MSG.PUSH_CHUNK,
          b64: chunk.toString("base64")
        });

        if (pushChunk.type === MSG.ERROR) {
          throw new UdbError(pushChunk.error || "Push chunk failed", "PUSH_FAILED");
        }

        totalRead += bytesRead;
      }
    } finally {
      fs.closeSync(fileHandle);
    }

    // Send PUSH_END
    const pushEnd = await session.sendMessage({
      type: MSG.PUSH_END,
      remotePath: remotePath
    });

    if (pushEnd.type === MSG.ERROR) {
      throw new UdbError(pushEnd.error || "Push end failed", "PUSH_FAILED");
    }

    if (pushEnd.type !== "push_ok") {
      throw new UdbError(`Unexpected response: ${pushEnd.type}`, "PROTOCOL_ERROR");
    }

    return { success: true, bytes: totalRead };
  } finally {
    if (!options.session) {
      session.close();
    }
  }
}

/**
 * Pull a file from a device
 * @param {string|object} target - Device target (ip:port or parsed target)
 * @param {string} remotePath - Path to file on device
 * @param {string} localPath - Where to save the file locally
 * @param {object} options - Options (session, timeout)
 * @returns {Promise<{success: boolean, bytes: number}>}
 */
export async function pull(target, remotePath, localPath, options = {}) {
  const parsed = parseTarget(target);
  const session = options.session || (await createSession(parsed));

  try {
    // Ensure directory exists
    fs.mkdirSync(path.dirname(localPath), { recursive: true });

    // Send PULL_BEGIN
    const pullBegin = await session.sendMessage({
      type: MSG.PULL_BEGIN,
      remotePath: remotePath
    });

    if (pullBegin.type === MSG.ERROR) {
      throw new UdbError(pullBegin.error || "Device rejected pull", "PULL_REJECTED");
    }

    // Receive file chunks
    const fileHandle = fs.openSync(localPath, "w");
    let totalBytes = 0;

    try {
      while (true) {
        const chunk = await session.waitForMessage([MSG.PULL_CHUNK, MSG.PULL_END, MSG.ERROR], 30000);

        if (chunk.type === MSG.ERROR) {
          fs.closeSync(fileHandle);
          fs.unlinkSync(localPath);
          throw new UdbError(chunk.error || "Pull failed on device", "PULL_FAILED");
        }

        if (chunk.type === MSG.PULL_END) {
          break;
        }

        if (chunk.type === MSG.PULL_CHUNK) {
          const data = Buffer.from(chunk.b64 || "", "base64");
          fs.writeSync(fileHandle, data);
          totalBytes += data.length;
        }
      }
    } finally {
      fs.closeSync(fileHandle);
    }

    return { success: true, bytes: totalBytes };
  } finally {
    if (!options.session) {
      session.close();
    }
  }
}

/* ===================== Exports ===================== */

/**
 * Alias for createSession - creates a session with streaming capability
 */
export async function createStreamingSession(target) {
  return createSession(target);
}

// Re-export transport classes for custom transport implementations
export { Transport, TcpTransport, createTcpTransport, SerialTransport, createSerialTransport, parseSerialTarget } from "./transport/index.js";

export default {
  discoverDevices,
  parseTarget,
  resolveTarget,
  probeTcp,
  status,
  getServices,
  getInfo,
  ping,
  pair,
  unpair,
  listPaired,
  exec,
  push,
  pull,
  getContexts,
  getCurrentContextName,
  setCurrentContext,
  addContext,
  getContext,
  removeContext,
  createSession,
  createStreamingSession,
  UdbSession,
  Stream,
  execBatch,
  UdbError,
  AuthError,
  ConnectionError,
  CommandError,
  getConfig,
  setConfig,
  // Transport layer
  TcpTransport,
  createTcpTransport,
  SerialTransport,
  createSerialTransport,
  parseSerialTarget
};
