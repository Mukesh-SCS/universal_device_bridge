#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// protocol/src/framing.js
function serializeBuffers(obj) {
  if (import_node_buffer.Buffer.isBuffer(obj)) {
    return { __buffer: true, data: obj.toString("base64") };
  }
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => serializeBuffers(item));
  }
  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = serializeBuffers(obj[key]);
  }
  return result;
}
function encodeFrame(obj) {
  const serializable = serializeBuffers(obj);
  const payload = import_node_buffer.Buffer.from(JSON.stringify(serializable), "utf8");
  const header = import_node_buffer.Buffer.alloc(4);
  header.writeUInt32BE(payload.length, 0);
  return import_node_buffer.Buffer.concat([header, payload]);
}
function createFrameDecoder(onMessage) {
  let buf = import_node_buffer.Buffer.alloc(0);
  return (chunk) => {
    buf = import_node_buffer.Buffer.concat([buf, chunk]);
    while (buf.length >= 4) {
      const len = buf.readUInt32BE(0);
      if (len <= 0 || len > MAX_FRAME_BYTES) {
        onMessage({ type: "error", error: "frame_too_large", max: MAX_FRAME_BYTES, got: len });
        buf = import_node_buffer.Buffer.alloc(0);
        return;
      }
      if (buf.length < 4 + len) return;
      const payload = buf.slice(4, 4 + len).toString("utf8");
      buf = buf.slice(4 + len);
      let msg;
      try {
        const reviver = (key, value) => {
          if (value && typeof value === "object" && value.__buffer === true) {
            return import_node_buffer.Buffer.from(value.data, "base64");
          }
          return value;
        };
        msg = JSON.parse(payload, reviver);
      } catch {
        onMessage({ type: "error", error: "invalid_json" });
        continue;
      }
      onMessage(msg);
    }
  };
}
var import_node_buffer, MAX_FRAME_BYTES;
var init_framing = __esm({
  "protocol/src/framing.js"() {
    import_node_buffer = require("node:buffer");
    MAX_FRAME_BYTES = 8 * 1024 * 1024;
  }
});

// protocol/src/messages.js
var MSG;
var init_messages = __esm({
  "protocol/src/messages.js"() {
    MSG = {
      HELLO: "hello",
      HELLO_OK: "hello_ok",
      PAIR_REQUEST: "pair_request",
      PAIR_OK: "pair_ok",
      PAIR_DENIED: "pair_denied",
      UNPAIR_REQUEST: "unpair_request",
      UNPAIR_OK: "unpair_ok",
      UNPAIR_ALL: "unpair_all",
      AUTH_REQUIRED: "auth_required",
      AUTH_CHALLENGE: "auth_challenge",
      AUTH_RESPONSE: "auth_response",
      AUTH_OK: "auth_ok",
      AUTH_FAIL: "auth_fail",
      EXEC: "exec",
      EXEC_RESULT: "exec_result",
      LOGS: "logs",
      LOGS_CHUNK: "logs_chunk",
      PUSH_BEGIN: "push_begin",
      PUSH_CHUNK: "push_chunk",
      PUSH_END: "push_end",
      PULL_BEGIN: "pull_begin",
      PULL_CHUNK: "pull_chunk",
      PULL_END: "pull_end",
      ERROR: "error",
      STATUS: "status",
      STATUS_RESULT: "status_result",
      LIST_PAIRED: "list_paired",
      LIST_PAIRED_RESULT: "list_paired_result",
      FILE_PUSH_START: "file_push_start",
      FILE_PUSH_CHUNK: "file_push_chunk",
      FILE_PUSH_END: "file_push_end",
      FILE_PULL_START: "file_pull_start",
      FILE_PULL_CHUNK: "file_pull_chunk",
      FILE_PULL_END: "file_pull_end",
      FILE_ERROR: "file_error",
      // Streaming services
      OPEN_SERVICE: "open_service",
      STREAM_DATA: "stream_data",
      STREAM_CLOSE: "stream_close",
      STREAM_RESIZE: "stream_resize",
      SERVICE_ERROR: "service_error"
    };
  }
});

// protocol/src/crypto.js
var crypto_exports = {};
__export(crypto_exports, {
  defaultClientKeyPaths: () => defaultClientKeyPaths,
  ensureDir: () => ensureDir,
  fingerprintPublicKeyPem: () => fingerprintPublicKeyPem,
  loadOrCreateClientKeypair: () => loadOrCreateClientKeypair,
  signNonce: () => signNonce,
  verifySignedNonce: () => verifySignedNonce
});
function ensureDir(p) {
  import_node_fs.default.mkdirSync(p, { recursive: true });
}
function defaultClientKeyPaths() {
  const dir = import_node_path.default.join(import_node_os.default.homedir(), ".udb");
  return {
    dir,
    priv: import_node_path.default.join(dir, "id_ed25519"),
    pub: import_node_path.default.join(dir, "id_ed25519.pub")
  };
}
function loadOrCreateClientKeypair() {
  const { dir, priv, pub } = defaultClientKeyPaths();
  ensureDir(dir);
  if (import_node_fs.default.existsSync(priv) && import_node_fs.default.existsSync(pub)) {
    return {
      privateKeyPem: import_node_fs.default.readFileSync(priv, "utf8"),
      publicKeyPem: import_node_fs.default.readFileSync(pub, "utf8")
    };
  }
  const { publicKey, privateKey } = import_node_crypto.default.generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  import_node_fs.default.writeFileSync(priv, privateKeyPem, { mode: 384 });
  import_node_fs.default.writeFileSync(pub, publicKeyPem, { mode: 420 });
  return { privateKeyPem, publicKeyPem };
}
function fingerprintPublicKeyPem(publicKeyPem) {
  const der = import_node_crypto.default.createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  const hash = import_node_crypto.default.createHash("sha256").update(der).digest("hex");
  return hash.slice(0, 16);
}
function verifySignedNonce({ publicKeyPem, nonce, signatureB64 }) {
  const publicKey = import_node_crypto.default.createPublicKey(publicKeyPem);
  const sig = Buffer.from(signatureB64, "base64");
  return import_node_crypto.default.verify(null, Buffer.from(nonce, "utf8"), publicKey, sig);
}
function signNonce({ privateKeyPem, nonce }) {
  const privateKey = import_node_crypto.default.createPrivateKey(privateKeyPem);
  const sig = import_node_crypto.default.sign(null, Buffer.from(nonce, "utf8"), privateKey);
  return sig.toString("base64");
}
var import_node_fs, import_node_os, import_node_path, import_node_crypto;
var init_crypto = __esm({
  "protocol/src/crypto.js"() {
    import_node_fs = __toESM(require("node:fs"), 1);
    import_node_os = __toESM(require("node:os"), 1);
    import_node_path = __toESM(require("node:path"), 1);
    import_node_crypto = __toESM(require("node:crypto"), 1);
  }
});

// client/src/transport/transport.js
var Transport;
var init_transport = __esm({
  "client/src/transport/transport.js"() {
    Transport = class {
      /**
       * @param {TransportOptions} options
       */
      constructor(options = {}) {
        this.options = options;
        this._dataCallback = null;
        this._errorCallback = null;
        this._closeCallback = null;
      }
      /**
       * Establish connection
       * @returns {Promise<void>}
       */
      async connect() {
        throw new Error("Transport.connect() must be implemented by subclass");
      }
      /**
       * Send data over the transport
       * @param {Buffer} data - Data to send
       */
      write(data) {
        throw new Error("Transport.write() must be implemented by subclass");
      }
      /**
       * Close connection gracefully
       */
      end() {
        throw new Error("Transport.end() must be implemented by subclass");
      }
      /**
       * Force close connection
       */
      destroy() {
        throw new Error("Transport.destroy() must be implemented by subclass");
      }
      /**
       * Register data received callback
       * @param {DataCallback} callback
       */
      onData(callback) {
        this._dataCallback = callback;
      }
      /**
       * Register error callback
       * @param {ErrorCallback} callback
       */
      onError(callback) {
        this._errorCallback = callback;
      }
      /**
       * Register close callback
       * @param {CloseCallback} callback
       */
      onClose(callback) {
        this._closeCallback = callback;
      }
      /**
       * Check if transport is connected
       * @returns {boolean}
       */
      isConnected() {
        throw new Error("Transport.isConnected() must be implemented by subclass");
      }
      /**
       * Get transport type name
       * @returns {string}
       */
      getType() {
        return "abstract";
      }
      /**
       * Emit data to registered callback
       * @protected
       * @param {Buffer} data
       */
      _emitData(data) {
        if (this._dataCallback) {
          this._dataCallback(data);
        }
      }
      /**
       * Emit error to registered callback
       * @protected
       * @param {Error} error
       */
      _emitError(error) {
        if (this._errorCallback) {
          this._errorCallback(error);
        }
      }
      /**
       * Emit close to registered callback
       * @protected
       */
      _emitClose() {
        if (this._closeCallback) {
          this._closeCallback();
        }
      }
    };
  }
});

// client/src/transport/tcp.js
function createTcpTransport(target, options = {}) {
  return new TcpTransport({
    host: target.host,
    port: target.port,
    ...options
  });
}
var import_node_net, TcpTransport;
var init_tcp = __esm({
  "client/src/transport/tcp.js"() {
    import_node_net = __toESM(require("node:net"), 1);
    init_transport();
    TcpTransport = class extends Transport {
      /**
       * @param {TcpTransportOptions} options
       */
      constructor(options) {
        super(options);
        if (!options.host || !options.port) {
          throw new Error("TcpTransport requires host and port");
        }
        this.host = options.host;
        this.port = options.port;
        this.timeout = options.timeout || 1e4;
        this.socket = null;
        this._connected = false;
      }
      /**
       * Establish TCP connection
       * @returns {Promise<void>}
       */
      async connect() {
        return new Promise((resolve, reject) => {
          this.socket = import_node_net.default.createConnection({
            host: this.host,
            port: this.port
          });
          const timeoutId = setTimeout(() => {
            this.socket.destroy();
            reject(new Error(`Connection timeout to ${this.host}:${this.port}`));
          }, this.timeout);
          this.socket.on("connect", () => {
            clearTimeout(timeoutId);
            this._connected = true;
            resolve();
          });
          this.socket.on("data", (data) => {
            this._emitData(data);
          });
          this.socket.on("error", (err) => {
            clearTimeout(timeoutId);
            this._connected = false;
            this._emitError(err);
            reject(err);
          });
          this.socket.on("close", () => {
            this._connected = false;
            this._emitClose();
          });
        });
      }
      /**
       * Send data over TCP
       * @param {Buffer} data
       */
      write(data) {
        if (this.socket && this._connected) {
          this.socket.write(data);
        }
      }
      /**
       * Close TCP connection gracefully
       */
      end() {
        if (this.socket) {
          this.socket.end();
        }
      }
      /**
       * Force close TCP connection
       */
      destroy() {
        if (this.socket) {
          this.socket.destroy();
        }
      }
      /**
       * Check if TCP socket is connected
       * @returns {boolean}
       */
      isConnected() {
        return this._connected && this.socket && !this.socket.destroyed;
      }
      /**
       * Get transport type
       * @returns {string}
       */
      getType() {
        return "tcp";
      }
      /**
       * Get remote address info
       * @returns {Object}
       */
      getRemoteInfo() {
        return {
          host: this.host,
          port: this.port,
          address: this.socket?.remoteAddress,
          family: this.socket?.remoteFamily
        };
      }
    };
  }
});

// client/src/transport/serial.js
function createSerialTransport(path5, options = {}) {
  return new SerialTransport({
    path: path5,
    ...options
  });
}
function parseSerialTarget(target) {
  if (!target.startsWith("serial://")) {
    throw new Error("Invalid serial target. Use: serial://PORT or serial:///dev/ttyUSB0");
  }
  const url = new URL(target);
  const baudRate = url.searchParams.get("baud");
  let path5;
  if (url.pathname && url.pathname.length > 1) {
    path5 = url.pathname;
  } else if (url.hostname) {
    path5 = url.hostname;
  } else {
    throw new Error("Serial path required. Use: serial://COM3 or serial:///dev/ttyUSB0");
  }
  if (!path5) {
    throw new Error("Serial path required. Use: serial://COM3 or serial:///dev/ttyUSB0");
  }
  return {
    path: path5.startsWith("/") ? path5 : process.platform === "win32" ? path5 : "/" + path5,
    baudRate: baudRate ? parseInt(baudRate, 10) : 115200
  };
}
var SerialTransport;
var init_serial = __esm({
  "client/src/transport/serial.js"() {
    init_transport();
    SerialTransport = class extends Transport {
      /**
       * @param {SerialTransportOptions} options
       */
      constructor(options) {
        super(options);
        if (!options.path) {
          throw new Error("SerialTransport requires path");
        }
        this.path = options.path;
        this.baudRate = options.baudRate || 115200;
        this.timeout = options.timeout || 1e4;
        this._serialportModule = options.serialport || null;
        this.port = null;
        this._connected = false;
      }
      /**
       * Lazy-load serialport module
       * This allows the module to be optional and not break on systems without it
       * @private
       */
      async _getSerialPort() {
        if (this._serialportModule) {
          return this._serialportModule;
        }
        try {
          const { SerialPort } = await import("serialport");
          return { SerialPort };
        } catch (err) {
          throw new Error(
            "serialport module not installed. Run: npm install serialport"
          );
        }
      }
      /**
       * Establish serial connection
       * @returns {Promise<void>}
       */
      async connect() {
        const { SerialPort } = await this._getSerialPort();
        return new Promise((resolve, reject) => {
          this.port = new SerialPort({
            path: this.path,
            baudRate: this.baudRate,
            autoOpen: false
          });
          const timeoutId = setTimeout(() => {
            if (this.port) {
              this.port.close();
            }
            reject(new Error(`Connection timeout to ${this.path}`));
          }, this.timeout);
          this.port.open((err) => {
            if (err) {
              clearTimeout(timeoutId);
              this._connected = false;
              reject(new Error(`Failed to open ${this.path}: ${err.message}`));
              return;
            }
            clearTimeout(timeoutId);
            this._connected = true;
            resolve();
          });
          this.port.on("data", (data) => {
            this._emitData(data);
          });
          this.port.on("error", (err) => {
            this._connected = false;
            this._emitError(err);
          });
          this.port.on("close", () => {
            this._connected = false;
            this._emitClose();
          });
        });
      }
      /**
       * Send data over serial
       * @param {Buffer} data
       */
      write(data) {
        if (this.port && this._connected && this.port.isOpen) {
          this.port.write(data);
        }
      }
      /**
       * Close serial connection gracefully
       */
      end() {
        if (this.port && this.port.isOpen) {
          this.port.close();
        }
      }
      /**
       * Force close serial connection
       */
      destroy() {
        if (this.port) {
          if (this.port.isOpen) {
            this.port.close();
          }
          this.port = null;
        }
        this._connected = false;
      }
      /**
       * Check if serial port is connected
       * @returns {boolean}
       */
      isConnected() {
        return this._connected && this.port && this.port.isOpen;
      }
      /**
       * Get transport type
       * @returns {string}
       */
      getType() {
        return "serial";
      }
      /**
       * Get serial port info
       * @returns {Object}
       */
      getPortInfo() {
        return {
          path: this.path,
          baudRate: this.baudRate,
          isOpen: this.port?.isOpen ?? false
        };
      }
      /**
       * List available serial ports
       * @static
       * @returns {Promise<Array>} List of available ports
       */
      static async listPorts() {
        try {
          const { SerialPort } = await import("serialport");
          return await SerialPort.list();
        } catch (err) {
          throw new Error(
            "serialport module not installed. Run: npm install serialport"
          );
        }
      }
    };
  }
});

// client/src/transport/index.js
var init_transport2 = __esm({
  "client/src/transport/index.js"() {
    init_transport();
    init_tcp();
    init_serial();
  }
});

// client/src/index.js
var src_exports = {};
__export(src_exports, {
  AuthError: () => AuthError,
  CommandError: () => CommandError,
  ConnectionError: () => ConnectionError,
  SerialTransport: () => SerialTransport,
  TcpTransport: () => TcpTransport,
  Transport: () => Transport,
  UdbError: () => UdbError,
  UdbSession: () => UdbSession,
  addContext: () => addContext,
  createSerialTransport: () => createSerialTransport,
  createSession: () => createSession,
  createStreamingSession: () => createStreamingSession,
  createTcpTransport: () => createTcpTransport,
  default: () => src_default,
  discoverDevices: () => discoverDevices,
  exec: () => exec,
  execBatch: () => execBatch,
  getConfig: () => getConfig,
  getContext: () => getContext,
  getContexts: () => getContexts,
  getCurrentContextName: () => getCurrentContextName,
  getInfo: () => getInfo,
  getServices: () => getServices,
  listPaired: () => listPaired,
  pair: () => pair,
  parseSerialTarget: () => parseSerialTarget,
  parseTarget: () => parseTarget,
  ping: () => ping,
  probeTcp: () => probeTcp,
  pull: () => pull,
  push: () => push,
  removeContext: () => removeContext,
  resolveTarget: () => resolveTarget,
  setConfig: () => setConfig,
  setCurrentContext: () => setCurrentContext,
  status: () => status,
  unpair: () => unpair
});
function readConfig() {
  try {
    return JSON.parse(import_node_fs2.default.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}
function writeConfig(cfg) {
  import_node_fs2.default.mkdirSync(import_node_path2.default.dirname(CONFIG_FILE), { recursive: true });
  import_node_fs2.default.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}
function getConfig() {
  return readConfig();
}
function setConfig(cfg) {
  writeConfig(cfg);
}
async function discoverDevices(timeoutMs = 1200) {
  return new Promise((resolve) => {
    const sock = import_node_dgram.default.createSocket("udp4");
    const found = /* @__PURE__ */ new Map();
    sock.on("message", (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.tcpPort) {
          const key = `${rinfo.address}:${data.tcpPort}`;
          found.set(key, {
            host: rinfo.address,
            port: data.tcpPort,
            name: data.name || "unknown"
          });
        }
      } catch {
      }
    });
    sock.bind(() => {
      sock.setBroadcast(true);
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
function parseTarget(arg) {
  if (arg.startsWith("tcp://")) {
    const u = new URL(arg);
    if (!u.hostname || !u.port) {
      throw new UdbError("Invalid tcp URL. Use: tcp://host:port", "INVALID_TARGET");
    }
    return { host: u.hostname, port: Number(u.port) };
  }
  const [host, port] = arg.split(":");
  if (!host || !port) {
    throw new UdbError("Invalid target. Use ip:port or tcp://host:port", "INVALID_TARGET");
  }
  return { host, port: Number(port) };
}
async function resolveTarget(maybeTarget) {
  if (maybeTarget) {
    if (typeof maybeTarget === "string") {
      return parseTarget(maybeTarget);
    }
    return maybeTarget;
  }
  const cfg = readConfig();
  if (cfg.currentContext) {
    const ctx = cfg.contexts?.[cfg.currentContext];
    if (ctx) {
      return { host: ctx.host, port: ctx.port };
    }
  }
  if (cfg.lastTarget) {
    return cfg.lastTarget;
  }
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
async function probeTcp(target, timeoutMs = 400) {
  return new Promise((resolve) => {
    const sock = new import_node_net2.default.Socket();
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
async function tcpRequest(target, messages, options = {}) {
  const {
    onStream = null,
    keepOpen = false,
    preAuth = false,
    timeoutMs = 1e4,
    ignoreTerminalTypes = [],
    // Types to ignore as terminal (e.g., AUTH_REQUIRED during pairing)
    transport = null
    // Optional custom transport
  } = options;
  const { publicKeyPem } = loadOrCreateClientKeypair();
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
      if (m.type === MSG.AUTH_OK) {
        sendQueued();
        return;
      }
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
        MSG.STREAM_DATA,
        // For service queries
        MSG.STREAM_CLOSE,
        // For service stream end
        MSG.SERVICE_ERROR
        // For service errors
      ];
      if (ignoreTerminalTypes.includes(m.type)) {
        return;
      }
      if (terminalTypes.includes(m.type)) {
        clearTimeout(timeout);
        resolve({ msg: m });
        if (!keepOpen) sock.end();
      }
    });
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
async function status(target) {
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
async function getServices(target) {
  target = typeof target === "string" ? parseTarget(target) : target;
  const { publicKeyPem } = loadOrCreateClientKeypair();
  const streamId = Math.floor(Math.random() * 1e6);
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
async function getInfo(target) {
  target = typeof target === "string" ? parseTarget(target) : target;
  const { publicKeyPem } = loadOrCreateClientKeypair();
  const streamId = Math.floor(Math.random() * 1e6);
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
async function ping(target) {
  target = typeof target === "string" ? parseTarget(target) : target;
  const streamId = Math.floor(Math.random() * 1e6);
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
async function pair(target) {
  target = typeof target === "string" ? parseTarget(target) : target;
  const { publicKeyPem } = loadOrCreateClientKeypair();
  const fp = fingerprintPublicKeyPem(publicKeyPem);
  const res = await tcpRequest(target, [{ type: MSG.PAIR_REQUEST }], {
    preAuth: true,
    ignoreTerminalTypes: [MSG.AUTH_REQUIRED]
    // Ignore AUTH_REQUIRED during pairing flow
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
async function unpair(target, options = {}) {
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
async function listPaired(target) {
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
async function exec(target, command) {
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
function getContexts() {
  const cfg = readConfig();
  return cfg.contexts || {};
}
function getCurrentContextName() {
  const cfg = readConfig();
  return cfg.currentContext || null;
}
function setCurrentContext(name) {
  const cfg = readConfig();
  if (!cfg.contexts || !cfg.contexts[name]) {
    throw new UdbError(`No such context: ${name}`, "CONTEXT_NOT_FOUND");
  }
  cfg.currentContext = name;
  writeConfig(cfg);
}
function addContext(name, target) {
  const cfg = readConfig();
  cfg.contexts = cfg.contexts || {};
  cfg.contexts[name] = target;
  writeConfig(cfg);
}
function getContext(name) {
  const contexts = getContexts();
  return contexts[name] || null;
}
function removeContext(name) {
  const cfg = readConfig();
  if (cfg.contexts) {
    delete cfg.contexts[name];
    if (cfg.currentContext === name) {
      delete cfg.currentContext;
    }
    writeConfig(cfg);
  }
}
async function createSession(target) {
  target = typeof target === "string" ? parseTarget(target) : target;
  const session = new UdbSession(target);
  await session.connect();
  return session;
}
async function execBatch(targets, command, options = {}) {
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
async function push(target, localPath, remotePath, options = {}) {
  const parsed = parseTarget(target);
  const session = options.session || await createSession(parsed);
  try {
    if (!import_node_fs2.default.existsSync(localPath)) {
      throw new UdbError(`Local file not found: ${localPath}`, "FILE_NOT_FOUND");
    }
    const fileStats = import_node_fs2.default.statSync(localPath);
    const fileSize = fileStats.size;
    const pushBegin = await session.sendMessage({
      type: MSG.PUSH_BEGIN,
      remotePath
    });
    if (pushBegin.type === MSG.ERROR) {
      throw new UdbError(pushBegin.error || "Device rejected push", "PUSH_REJECTED");
    }
    if (pushBegin.type !== "push_ready") {
      throw new UdbError(`Unexpected response: ${pushBegin.type}`, "PROTOCOL_ERROR");
    }
    const chunkSize = 64 * 1024;
    const buffer = Buffer.alloc(chunkSize);
    const fileHandle = import_node_fs2.default.openSync(localPath, "r");
    let bytesRead = 0;
    let totalRead = 0;
    try {
      while ((bytesRead = import_node_fs2.default.readSync(fileHandle, buffer, 0, chunkSize)) > 0) {
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
      import_node_fs2.default.closeSync(fileHandle);
    }
    const pushEnd = await session.sendMessage({
      type: MSG.PUSH_END,
      remotePath
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
async function pull(target, remotePath, localPath, options = {}) {
  const parsed = parseTarget(target);
  const session = options.session || await createSession(parsed);
  try {
    import_node_fs2.default.mkdirSync(import_node_path2.default.dirname(localPath), { recursive: true });
    const pullBegin = await session.sendMessage({
      type: MSG.PULL_BEGIN,
      remotePath
    });
    if (pullBegin.type === MSG.ERROR) {
      throw new UdbError(pullBegin.error || "Device rejected pull", "PULL_REJECTED");
    }
    const fileHandle = import_node_fs2.default.openSync(localPath, "w");
    let totalBytes = 0;
    try {
      while (true) {
        const chunk = await session.waitForMessage([MSG.PULL_CHUNK, MSG.PULL_END, MSG.ERROR], 3e4);
        if (chunk.type === MSG.ERROR) {
          import_node_fs2.default.closeSync(fileHandle);
          import_node_fs2.default.unlinkSync(localPath);
          throw new UdbError(chunk.error || "Pull failed on device", "PULL_FAILED");
        }
        if (chunk.type === MSG.PULL_END) {
          break;
        }
        if (chunk.type === MSG.PULL_CHUNK) {
          const data = Buffer.from(chunk.b64 || "", "base64");
          import_node_fs2.default.writeSync(fileHandle, data);
          totalBytes += data.length;
        }
      }
    } finally {
      import_node_fs2.default.closeSync(fileHandle);
    }
    return { success: true, bytes: totalBytes };
  } finally {
    if (!options.session) {
      session.close();
    }
  }
}
async function createStreamingSession(target) {
  return createSession(target);
}
var import_node_fs2, import_node_os2, import_node_path2, import_node_dgram, import_node_net2, CONFIG_FILE, UdbError, AuthError, ConnectionError, CommandError, Stream, UdbSession, src_default;
var init_src = __esm({
  "client/src/index.js"() {
    import_node_fs2 = __toESM(require("node:fs"), 1);
    import_node_os2 = __toESM(require("node:os"), 1);
    import_node_path2 = __toESM(require("node:path"), 1);
    import_node_dgram = __toESM(require("node:dgram"), 1);
    import_node_net2 = __toESM(require("node:net"), 1);
    init_framing();
    init_messages();
    init_crypto();
    init_transport2();
    init_transport2();
    CONFIG_FILE = import_node_path2.default.join(import_node_os2.default.homedir(), ".udb", "config.json");
    UdbError = class extends Error {
      constructor(message, code, details = {}) {
        super(message);
        this.name = "UdbError";
        this.code = code;
        this.details = details;
      }
    };
    AuthError = class extends UdbError {
      constructor(message) {
        super(message, "AUTH_FAILED");
        this.name = "AuthError";
      }
    };
    ConnectionError = class extends UdbError {
      constructor(message, details) {
        super(message, "CONNECTION_FAILED", details);
        this.name = "ConnectionError";
      }
    };
    CommandError = class extends UdbError {
      constructor(message, exitCode) {
        super(message, "COMMAND_FAILED");
        this.code = exitCode;
        this.name = "CommandError";
      }
    };
    Stream = class {
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
        const b64Data = typeof data === "string" ? Buffer.from(data).toString("base64") : Buffer.isBuffer(data) ? data.toString("base64") : Buffer.from(String(data)).toString("base64");
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
          this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
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
    };
    UdbSession = class {
      constructor(target) {
        this.target = target;
        this.socket = null;
        this.decoder = null;
        this.authenticated = false;
        this.pendingCallbacks = /* @__PURE__ */ new Map();
        this.messageQueue = [];
        this.callId = 0;
        this.openStreams = /* @__PURE__ */ new Map();
        this.nextStreamId = 1;
      }
      /**
       * Connect and authenticate
       */
      async connect() {
        return new Promise((resolve, reject) => {
          const { publicKeyPem } = loadOrCreateClientKeypair();
          this.socket = import_node_net2.default.createConnection(this.target);
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
            const cb = this.pendingCallbacks.get(m.callId || "default");
            if (cb) {
              cb(m);
            } else {
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
          }, options.timeoutMs || 1e4);
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
        this.socket.write(
          encodeFrame({
            type: MSG.OPEN_SERVICE,
            streamId,
            service: serviceName,
            ...options
          })
        );
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
          }, options.timeoutMs || 3e4);
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
      async waitForMessage(types, timeoutMs = 1e4) {
        if (!Array.isArray(types)) {
          types = [types];
        }
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
            } else {
              this.messageQueue.push(msg);
            }
          };
          this.pendingCallbacks.set("default", cb);
        });
      }
    };
    src_default = {
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
  }
});

// cli/src/udb.js
var import_node_fs4 = __toESM(require("node:fs"), 1);
var import_node_os4 = __toESM(require("node:os"), 1);
var import_node_path4 = __toESM(require("node:path"), 1);
var import_node_readline = __toESM(require("node:readline"), 1);
var import_node_child_process = require("node:child_process");
init_src();

// client/src/fleet.js
var import_node_fs3 = __toESM(require("node:fs"), 1);
var import_node_os3 = __toESM(require("node:os"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);
init_src();
var CONFIG_FILE2 = import_node_path3.default.join(import_node_os3.default.homedir(), ".udb", "fleet.json");
function readFleetConfig() {
  try {
    return JSON.parse(import_node_fs3.default.readFileSync(CONFIG_FILE2, "utf8"));
  } catch {
    return { groups: {}, labels: {} };
  }
}
function writeFleetConfig(cfg) {
  import_node_fs3.default.mkdirSync(import_node_path3.default.dirname(CONFIG_FILE2), { recursive: true });
  import_node_fs3.default.writeFileSync(CONFIG_FILE2, JSON.stringify(cfg, null, 2));
}
function createGroup(groupName, targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error("targets must be non-empty array");
  }
  const cfg = readFleetConfig();
  cfg.groups = cfg.groups || {};
  cfg.groups[groupName] = targets.map((t) => ({
    host: t.host || t,
    port: t.port || 9910
  }));
  writeFleetConfig(cfg);
  return { group: groupName, deviceCount: targets.length };
}
function getGroup(groupName) {
  const cfg = readFleetConfig();
  return cfg.groups?.[groupName] || [];
}
function listGroups() {
  const cfg = readFleetConfig();
  return Object.entries(cfg.groups || {}).map(([name, devices]) => ({
    name,
    deviceCount: devices.length,
    devices
  }));
}
function exportInventory() {
  const cfg = readFleetConfig();
  const groups = {};
  for (const [name, devices] of Object.entries(cfg.groups || {})) {
    groups[name] = devices.map((d) => {
      const key = `${d.host}:${d.port}`;
      return {
        ...d,
        labels: cfg.labels?.[key] || {}
      };
    });
  }
  return {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    groups,
    devices: Object.entries(cfg.labels || {}).map(([key, labels]) => {
      const [host, port] = key.split(":");
      return { host, port: Number(port), labels };
    })
  };
}
async function execOnGroup(groupName, command, options = {}) {
  const targets = getGroup(groupName);
  if (targets.length === 0) {
    throw new Error(`Group not found or empty: ${groupName}`);
  }
  return execBatch(targets, command, options);
}

// cli/src/udb.js
var [, , cmd, ...rest] = process.argv;
var UDB_DIR = import_node_path4.default.join(import_node_os4.default.homedir(), ".udb");
var PID_FILE = import_node_path4.default.join(UDB_DIR, "udbd.pid");
var json = rest.includes("--json") || rest.includes("-j");
var EXIT = {
  SUCCESS: 0,
  ERROR: 1,
  USAGE: 2
};
function die(msg, exitCode = EXIT.ERROR) {
  if (json) {
    console.log(JSON.stringify({
      success: false,
      error: {
        code: exitCode === EXIT.USAGE ? "USAGE_ERROR" : "ERROR",
        message: msg
      }
    }, null, 2));
  } else {
    console.error(msg);
  }
  process.exit(exitCode);
}
function usageError(msg) {
  die(msg, EXIT.USAGE);
}
function hasFlag(name) {
  return rest.includes(name);
}
function getFlagValue(name) {
  const i = rest.indexOf(name);
  return i !== -1 ? rest[i + 1] : void 0;
}
function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function promptDeviceSelection(devices) {
  console.log("\nMultiple devices found:");
  devices.forEach((d, i) => {
    const name = d.name || "unknown";
    const target = `${d.host}:${d.port}`;
    console.log(`  [${i + 1}] ${name.padEnd(20)} ${target}`);
  });
  console.log("");
  const rl = import_node_readline.default.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question("Select device [1]: ", (answer) => {
      rl.close();
      const idx = answer.trim() === "" ? 0 : parseInt(answer, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= devices.length) {
        resolve(devices[0]);
      } else {
        resolve(devices[idx]);
      }
    });
  });
}
async function resolveTargetInteractive(maybeTarget) {
  try {
    return await resolveTarget(maybeTarget);
  } catch (err) {
    if (err.code === "AMBIGUOUS_TARGET" && process.stdout.isTTY && !json) {
      const devices = await discoverDevices();
      const selected = await promptDeviceSelection(devices);
      addContext("default", {
        host: selected.host,
        port: selected.port,
        name: selected.name || ""
      });
      setCurrentContext("default");
      return selected;
    }
    throw err;
  }
}
function formatError(err) {
  if (err instanceof AuthError) {
    return {
      message: `Device requires pairing.
Run: udb pair <target>`,
      code: "AUTH_FAILED"
    };
  }
  if (err instanceof ConnectionError) {
    return { message: `Connection failed: ${err.message}`, code: "CONNECTION_FAILED" };
  }
  if (err instanceof CommandError) {
    return { message: `Command failed with exit code ${err.code}`, code: "COMMAND_FAILED" };
  }
  if (err instanceof UdbError) {
    return { message: `${err.code}: ${err.message}`, code: err.code };
  }
  return { message: `Error: ${err.message}`, code: "ERROR" };
}
function handleError(err) {
  const { message, code } = formatError(err);
  if (json) {
    console.log(JSON.stringify({
      success: false,
      error: { code, message }
    }, null, 2));
  } else {
    console.error(message);
  }
  process.exit(EXIT.ERROR);
}
async function daemonStart() {
  import_node_fs4.default.mkdirSync(UDB_DIR, { recursive: true });
  if (import_node_fs4.default.existsSync(PID_FILE)) {
    const pid = Number(import_node_fs4.default.readFileSync(PID_FILE, "utf8"));
    if (isRunning(pid)) {
      console.log(`Daemon already running (pid ${pid})`);
      return;
    }
    import_node_fs4.default.unlinkSync(PID_FILE);
  }
  const daemonPath = import_node_path4.default.resolve("daemon/linux/udbd.js");
  const child = (0, import_node_child_process.spawn)("node", [daemonPath, "--pairing", "auto"], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
  import_node_fs4.default.writeFileSync(PID_FILE, String(child.pid));
  console.log(`Daemon started (pid ${child.pid})`);
}
async function daemonStop() {
  if (!import_node_fs4.default.existsSync(PID_FILE)) {
    console.log("Daemon not running");
    return;
  }
  const pid = Number(import_node_fs4.default.readFileSync(PID_FILE, "utf8"));
  try {
    process.kill(pid);
    console.log(`Daemon stopped (pid ${pid})`);
  } catch {
    console.log("Daemon process already dead");
  }
  import_node_fs4.default.unlinkSync(PID_FILE);
}
async function daemonStatus() {
  if (!import_node_fs4.default.existsSync(PID_FILE)) {
    console.log("Daemon not running");
    return;
  }
  const pid = Number(import_node_fs4.default.readFileSync(PID_FILE, "utf8"));
  console.log(
    isRunning(pid) ? `Daemon running (pid ${pid})` : "PID file exists but daemon not running"
  );
}
async function statusCmd() {
  try {
    let targetArg = void 0;
    if (rest.length > 0 && rest[0].includes(":")) {
      targetArg = rest[0];
    }
    const target = await resolveTarget(targetArg);
    const result = await status(target);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Device: ${result.name}`);
      console.log(`Pairing mode: ${result.pairingMode}`);
      console.log(`Exec enabled: ${result.execEnabled}`);
      console.log(`Paired clients: ${result.pairedCount}`);
    }
  } catch (err) {
    handleError(err);
  }
}
async function servicesCmd() {
  try {
    let targetArg = void 0;
    if (rest.length > 0 && rest[0].includes(":")) {
      targetArg = rest[0];
    }
    const target = await resolveTarget(targetArg);
    const result = await getServices(target);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("Available services:");
      for (const [name, caps] of Object.entries(result.services || {})) {
        const capsStr = Object.entries(caps).map(([k, v]) => `${k}=${v}`).join(", ");
        console.log(`  ${name}: ${capsStr}`);
      }
    }
  } catch (err) {
    handleError(err);
  }
}
async function infoCmd() {
  try {
    let targetArg = void 0;
    if (rest.length > 0 && rest[0].includes(":")) {
      targetArg = rest[0];
    }
    const target = await resolveTarget(targetArg);
    const result = await getInfo(target);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Name: ${result.name}`);
      console.log(`Type: ${result.deviceType || "unknown"}`);
      console.log(`Version: ${result.version}`);
      console.log(`Build: ${result.build}`);
      console.log(`Platform: ${result.platform}`);
      console.log(`Arch: ${result.arch}`);
      console.log(`Protocol: ${result.protocol}`);
      console.log(`Pairing mode: ${result.pairingMode}`);
      console.log(`Exec enabled: ${result.execEnabled}`);
      console.log(`TCP port: ${result.tcpPort}`);
      console.log(`UDP port: ${result.udpPort}`);
    }
  } catch (err) {
    handleError(err);
  }
}
async function pingCmd() {
  try {
    let targetArg = void 0;
    if (rest.length > 0 && rest[0].includes(":")) {
      targetArg = rest[0];
    }
    const target = await resolveTarget(targetArg);
    const { ping: ping2 } = await Promise.resolve().then(() => (init_src(), src_exports));
    const result = await ping2(target);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\u2714 Pong from ${result.name}`);
      console.log(`Latency: ${result.latencyMs}ms`);
      console.log(`Uptime: ${Math.floor(result.uptime)}s`);
    }
  } catch (err) {
    handleError(err);
  }
}
async function devicesCmd() {
  try {
    const devices = await discoverDevices();
    const contexts = getContexts();
    const merged = /* @__PURE__ */ new Map();
    for (const d of devices) {
      const key = `${d.host}:${d.port}`;
      const ctx = Object.entries(contexts).find(
        ([, c]) => c.host === d.host && c.port === d.port
      );
      merged.set(key, {
        host: d.host,
        port: d.port,
        name: d.name,
        context: ctx ? ctx[0] : null,
        online: true,
        source: "udp",
        type: "unknown"
      });
    }
    for (const [ctxName, ctx] of Object.entries(contexts)) {
      const key = `${ctx.host}:${ctx.port}`;
      if (!merged.has(key)) {
        merged.set(key, {
          host: ctx.host,
          port: ctx.port,
          name: ctx.name || "",
          context: ctxName,
          online: false,
          source: "context",
          type: "unknown"
        });
      }
    }
    const deviceList = [...merged.values()];
    await Promise.all(
      deviceList.map(async (d) => {
        if (d.source === "context") {
          d.online = await probeTcp({ host: d.host, port: d.port });
        }
        if (d.online) {
          try {
            const info = await getInfo({ host: d.host, port: d.port });
            d.type = info.deviceType || (info.simulator ? "simulator" : "unknown");
            if (!d.name && info.name) d.name = info.name;
          } catch {
          }
        }
      })
    );
    if (json) {
      console.log(
        JSON.stringify(
          deviceList.map((d) => ({
            host: d.host,
            port: d.port,
            name: d.name,
            type: d.type,
            context: d.context,
            online: d.online,
            source: d.source
          })),
          null,
          2
        )
      );
    } else {
      console.log(`${"NAME".padEnd(16)} ${"TYPE".padEnd(16)} ${"TARGET".padEnd(24)} STATUS`);
      console.log("\u2500".repeat(70));
      for (const d of deviceList) {
        const name = (d.name || d.context || "-").substring(0, 15).padEnd(16);
        const type = (d.type || "unknown").padEnd(16);
        const target = `${d.host}:${d.port}`.padEnd(24);
        const status2 = d.online ? "online" : "offline";
        console.log(`${name} ${type} ${target} ${status2}`);
      }
    }
  } catch (err) {
    handleError(err);
  }
}
async function pairCmd() {
  try {
    const target = await resolveTarget(rest[0]);
    const result = await pair(target);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Paired OK fp=${result.fingerprint}`);
    }
  } catch (err) {
    handleError(err);
  }
}
async function unpairCmd() {
  try {
    const target = await resolveTarget(rest[0]);
    const options = {};
    if (hasFlag("--all")) options.all = true;
    if (getFlagValue("--fp")) options.fingerprint = getFlagValue("--fp");
    if (options.all && options.fingerprint) {
      usageError("Use only one of --all or --fp <fingerprint>");
    }
    const result = await unpair(target, options);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.scope === "all") {
        console.log(`Unpaired ALL clients (removed=${result.removed})`);
      } else if (result.removed) {
        console.log(`Unpaired fp=${result.fingerprint}`);
      } else {
        console.log(`No pairing found for fp=${result.fingerprint}`);
      }
    }
  } catch (err) {
    handleError(err);
  }
}
async function listPairedCmd() {
  try {
    const target = await resolveTarget(rest[0]);
    const devices = await listPaired(target);
    if (devices.length === 0) {
      console.log("No paired clients.");
      return;
    }
    if (json) {
      console.log(JSON.stringify(devices, null, 2));
    } else {
      for (const d of devices) {
        console.log(`${d.fp}  name=${d.name}  added=${d.addedAt}`);
      }
    }
  } catch (err) {
    handleError(err);
  }
}
async function execCmd() {
  try {
    let targetArg;
    let command;
    if (rest[0] && rest[0].includes(":")) {
      targetArg = rest[0];
      command = rest.slice(1).join(" ").trim();
    } else {
      targetArg = void 0;
      command = rest.join(" ").trim();
    }
    if (!command) {
      usageError('Usage: udb exec [ip:port] "<cmd>"');
    }
    const target = await resolveTargetInteractive(targetArg);
    const result = await exec(target, command);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.exitCode ?? 0);
  } catch (err) {
    if (err instanceof CommandError) {
      process.exit(err.code);
    }
    handleError(err);
  }
}
async function shellCmd() {
  let restoreTerminal = false;
  try {
    let targetArg;
    if (rest[0] && rest[0].includes(":")) {
      targetArg = rest[0];
    } else {
      targetArg = void 0;
    }
    const target = await resolveTargetInteractive(targetArg);
    const { createStreamingSession: createStreamingSession2 } = await Promise.resolve().then(() => (init_src(), src_exports));
    const session = await createStreamingSession2(target);
    const shellStream = await session.openService("shell", {
      pty: true,
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24
    });
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      restoreTerminal = true;
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onResize = () => {
      if (process.stdout.isTTY) {
        shellStream.resize(process.stdout.columns || 80, process.stdout.rows || 24);
      }
    };
    process.stdout.on("resize", onResize);
    const onStdin = (chunk) => {
      try {
        shellStream.write(chunk);
      } catch (err) {
      }
    };
    process.stdin.on("data", onStdin);
    const onData = (chunk) => {
      process.stdout.write(chunk);
    };
    shellStream.on("data", onData);
    const onClose = () => {
      cleanup();
      process.exit(0);
    };
    shellStream.on("close", onClose);
    const onError = (err) => {
      cleanup();
      if (err.message && err.message !== "stream_closed") {
        console.error(`Shell error: ${err.message}`);
      }
      process.exit(1);
    };
    shellStream.on("error", onError);
    const cleanup = () => {
      shellStream.off("data", onData);
      shellStream.off("close", onClose);
      shellStream.off("error", onError);
      process.stdin.off("data", onStdin);
      process.stdout.off("resize", onResize);
      if (restoreTerminal && process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };
  } catch (err) {
    if (restoreTerminal && process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    handleError(err);
  }
}
async function connectCmd() {
  try {
    if (!rest[0]) {
      usageError("Usage: udb connect <ip:port | name>");
    }
    const arg = rest[0];
    let target;
    if (arg.includes(":")) {
      target = parseTarget(arg);
    } else {
      const devices = await discoverDevices();
      const matches = devices.filter((d) => d.name === arg);
      if (matches.length === 0) {
        usageError(`No device named "${arg}"`);
      }
      if (matches.length > 1) {
        usageError(`Multiple devices named "${arg}". Use ip:port.`);
      }
      target = matches[0];
    }
    const reachable = await probeTcp(target);
    if (!reachable) {
      die(`Cannot connect to ${target.host}:${target.port}`);
    }
    let deviceName = "";
    try {
      const info = await getInfo(target);
      deviceName = info.name || "";
    } catch {
    }
    addContext("default", {
      host: target.host,
      port: target.port,
      name: deviceName
    });
    setCurrentContext("default");
    if (json) {
      console.log(JSON.stringify({
        success: true,
        connected: `${target.host}:${target.port}`,
        name: deviceName
      }, null, 2));
    } else {
      console.log(`connected to ${target.host}:${target.port}`);
    }
  } catch (err) {
    handleError(err);
  }
}
async function configShowCmd() {
  try {
    const { getConfig: getConfig2 } = await Promise.resolve().then(() => (init_src(), src_exports));
    const cfg = getConfig2();
    if (json) {
      console.log(JSON.stringify(cfg, null, 2));
    } else {
      if (!cfg.lastTarget) {
        console.log("No config set yet.");
        console.log(
          'Tip: run `udb exec <ip:port> "whoami"` once, or use `udb connect <ip:port>`.'
        );
      } else {
        const last = cfg.lastTarget;
        console.log(`Last target: ${last.host}:${last.port}`);
      }
    }
  } catch (err) {
    handleError(err);
  }
}
async function contextListCmd() {
  try {
    const contexts = getContexts();
    const current = getCurrentContextName();
    const rows = Object.entries(contexts).map(([name, ctx]) => ({
      name,
      host: ctx.host,
      port: ctx.port,
      device: ctx.name || "",
      current: name === current
    }));
    if (json) {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      if (rows.length === 0) {
        console.log("No contexts defined.");
        console.log("Use: udb context add <name> <ip:port>");
      } else {
        for (const r of rows) {
          const mark = r.current ? "*" : " ";
          console.log(
            `${mark} ${r.name.padEnd(12)} ${r.host}:${r.port}  ${r.device}`
          );
        }
      }
    }
  } catch (err) {
    handleError(err);
  }
}
async function contextAddCmd() {
  try {
    if (rest.length < 3) {
      usageError("Usage: context add <name> <ip:port | device-name>");
    }
    const ctxName = rest[1];
    const arg = rest[2];
    let target;
    if (arg.includes(":")) {
      target = parseTarget(arg);
    } else {
      const devices = await discoverDevices();
      if (devices.length === 0) {
        usageError("No devices found (discovery unavailable)");
      }
      const matches = devices.filter((d) => d.name === arg);
      if (matches.length === 0) {
        usageError(`No device named "${arg}"`);
      }
      if (matches.length > 1) {
        usageError(`Multiple devices named "${arg}". Use ip:port.`);
      }
      target = matches[0];
    }
    const result = await status(target);
    addContext(ctxName, {
      host: target.host,
      port: target.port,
      name: result.name
    });
    if (json) {
      console.log(
        JSON.stringify(
          {
            context: ctxName,
            target: `${target.host}:${target.port}`,
            name: result.name
          },
          null,
          2
        )
      );
    } else {
      console.log(
        `Context "${ctxName}" added \u2192 ${target.host}:${target.port}  name=${result.name}`
      );
    }
  } catch (err) {
    handleError(err);
  }
}
async function contextUseCmd() {
  try {
    if (!rest[1]) {
      usageError("Usage: context use <name>");
    }
    const name = rest[1];
    const ctx = getContext(name);
    if (!ctx) {
      usageError(`No such context "${name}"`);
    }
    const result = await status(ctx);
    setCurrentContext(name);
    if (json) {
      console.log(
        JSON.stringify(
          {
            context: name,
            target: `${ctx.host}:${ctx.port}`,
            name: result.name
          },
          null,
          2
        )
      );
    } else {
      console.log(
        `Using context "${name}" \u2192 ${ctx.host}:${ctx.port}  name=${result.name}`
      );
    }
  } catch (err) {
    handleError(err);
  }
}
async function groupListCmd() {
  try {
    const groups = listGroups();
    if (json) {
      console.log(JSON.stringify(groups, null, 2));
    } else {
      if (groups.length === 0) {
        console.log("No groups defined.");
        console.log("Use: udb group add <name> <ip:port> [<ip:port> ...]");
      } else {
        for (const g of groups) {
          console.log(`${g.name}: ${g.deviceCount} device(s)`);
          for (const d of g.devices) {
            console.log(`  - ${d.host}:${d.port}`);
          }
        }
      }
    }
  } catch (err) {
    handleError(err);
  }
}
async function groupAddCmd() {
  try {
    if (rest.length < 3) {
      usageError("Usage: group add <name> <ip:port> [<ip:port> ...]");
    }
    const groupName = rest[1];
    const targets = rest.slice(2).map((t) => parseTarget(t));
    const result = createGroup(groupName, targets);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\u2713 Created group "${groupName}" with ${result.deviceCount} device(s)`);
    }
  } catch (err) {
    handleError(err);
  }
}
async function groupExecCmd() {
  try {
    if (rest.length < 3) {
      usageError('Usage: group exec <name> "<cmd>"');
    }
    const groupName = rest[1];
    const command = rest.slice(2).join(" ").trim();
    console.log(`Running "${command}" on group "${groupName}"...`);
    const results = await execOnGroup(groupName, command, { parallel: true });
    if (json) {
      console.log(
        JSON.stringify(
          results.map((r) => ({
            target: `${r.target.host}:${r.target.port}`,
            success: r.success,
            exitCode: r.result?.exitCode,
            stdout: r.result?.stdout,
            error: r.error?.message
          })),
          null,
          2
        )
      );
    } else {
      for (const res of results) {
        const target = `${res.target.host}:${res.target.port}`;
        if (res.success) {
          console.log(`
\u2713 ${target}:`);
          if (res.result.stdout) console.log(res.result.stdout.trim());
        } else {
          console.log(`
\u2717 ${target}: ${res.error.message}`);
        }
      }
    }
  } catch (err) {
    handleError(err);
  }
}
async function inventoryCmd() {
  try {
    const inventory = exportInventory();
    if (json) {
      console.log(JSON.stringify(inventory, null, 2));
    } else {
      console.log("UDB Fleet Inventory\n");
      console.log(`Generated: ${inventory.timestamp}
`);
      console.log("Groups:");
      for (const [name, devices] of Object.entries(inventory.groups)) {
        console.log(`  ${name}:`);
        for (const d of devices) {
          const labels = Object.entries(d.labels).map(([k, v]) => `${k}=${v}`).join(" ");
          console.log(`    ${d.host}:${d.port} ${labels}`);
        }
      }
    }
  } catch (err) {
    handleError(err);
  }
}
async function pushCmd() {
  try {
    let parsePushArgs = function(args) {
      if (args.length === 2) {
        return { target: null, src: args[0], dst: args[1] };
      }
      if (args.length === 3) {
        return { target: args[0], src: args[1], dst: args[2] };
      }
      usageError("Usage: udb push [target] <src> <dst>");
    };
    const { target, src, dst } = parsePushArgs(rest);
    if (!src || !dst) usageError("Usage: udb push [target] <src> <dst>");
    if (!import_node_fs4.default.existsSync(src)) usageError(`Local file not found: ${src}`);
    const resolvedTarget = await resolveTarget(target);
    const stats = import_node_fs4.default.statSync(src);
    console.log(`Pushing ${src} (${stats.size} bytes) to ${resolvedTarget.host}:${dst}...`);
    const result = await push(resolvedTarget, src, dst);
    console.log(`\u2713 Pushed ${result.bytes} bytes successfully`);
  } catch (err) {
    handleError(err);
  }
}
async function pullCmd() {
  try {
    let parsePullArgs = function(args) {
      if (args.length === 2) {
        return { target: null, src: args[0], dst: args[1] };
      }
      if (args.length === 3) {
        return { target: args[0], src: args[1], dst: args[2] };
      }
      usageError("Usage: udb pull [target] <src> <dst>");
    };
    const { target, src, dst } = parsePullArgs(rest);
    if (!src || !dst) usageError("Usage: udb pull [target] <src> <dst>");
    const resolvedTarget = await resolveTarget(target);
    console.log(`Pulling ${src} from ${resolvedTarget.host} to ${dst}...`);
    const result = await pull(resolvedTarget, src, dst);
    console.log(`\u2713 Pulled ${result.bytes} bytes successfully to ${dst}`);
  } catch (err) {
    handleError(err);
  }
}
async function doctorCmd() {
  const checks = [];
  const isFirstRun = hasFlag("--first-run");
  let targetArg = rest.find((r) => r.includes(":") && !r.startsWith("--"));
  if (isFirstRun) {
    console.log("\u{1F680} UDB First-Run Setup\n");
    console.log("Welcome to UDB! Let's make sure everything is ready.\n");
  } else {
    console.log("\u{1F50D} UDB Doctor - Diagnosing connectivity and configuration\n");
  }
  console.log("1. Checking local configuration...");
  try {
    const configDir = import_node_path4.default.join(import_node_os4.default.homedir(), ".udb");
    if (import_node_fs4.default.existsSync(configDir)) {
      checks.push({ name: "Config directory", status: "ok", detail: configDir });
      console.log(`   \u2713 Config directory exists: ${configDir}`);
    } else {
      checks.push({ name: "Config directory", status: "warning", detail: "Not created yet" });
      console.log(`   \u26A0 Config directory not found (will be created on first use)`);
    }
  } catch (err) {
    checks.push({ name: "Config directory", status: "error", detail: err.message });
    console.log(`   \u2717 Config directory check failed: ${err.message}`);
  }
  console.log("2. Checking client keypair...");
  try {
    const keyDir = import_node_path4.default.join(import_node_os4.default.homedir(), ".udb");
    const pubKeyPath = import_node_path4.default.join(keyDir, "id_ed25519.pub");
    const privKeyPath = import_node_path4.default.join(keyDir, "id_ed25519");
    if (import_node_fs4.default.existsSync(pubKeyPath) && import_node_fs4.default.existsSync(privKeyPath)) {
      checks.push({ name: "Client keypair", status: "ok", detail: pubKeyPath });
      console.log(`   \u2713 Client keypair found`);
    } else if (isFirstRun) {
      console.log(`   \u26A0 No keypair found. Generating...`);
      const { loadOrCreateClientKeypair: loadOrCreateClientKeypair2, fingerprintPublicKeyPem: fingerprintPublicKeyPem2 } = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
      const { publicKeyPem } = loadOrCreateClientKeypair2();
      const fp = fingerprintPublicKeyPem2(publicKeyPem);
      checks.push({ name: "Client keypair", status: "ok", detail: `Generated, fingerprint: ${fp}` });
      console.log(`   \u2713 Keypair generated! Fingerprint: ${fp}`);
    } else {
      checks.push({ name: "Client keypair", status: "warning", detail: "Not created yet" });
      console.log(`   \u26A0 Client keypair not found (will be created on first operation)`);
    }
  } catch (err) {
    checks.push({ name: "Client keypair", status: "error", detail: err.message });
    console.log(`   \u2717 Keypair check failed: ${err.message}`);
  }
  console.log("3. Checking contexts...");
  try {
    const contexts = getContexts();
    const count = Object.keys(contexts).length;
    const currentCtx = getCurrentContextName();
    if (count > 0) {
      checks.push({ name: "Contexts", status: "ok", detail: `${count} contexts, current: ${currentCtx || "none"}` });
      console.log(`   \u2713 ${count} context(s) configured, current: ${currentCtx || "(none)"}`);
    } else {
      checks.push({ name: "Contexts", status: "info", detail: "No contexts saved" });
      console.log(`   \u2139 No contexts saved yet`);
    }
  } catch (err) {
    checks.push({ name: "Contexts", status: "error", detail: err.message });
    console.log(`   \u2717 Context check failed: ${err.message}`);
  }
  console.log("4. Resolving target...");
  let target = null;
  try {
    target = await resolveTarget(targetArg);
    checks.push({ name: "Target resolution", status: "ok", detail: `${target.host}:${target.port}` });
    console.log(`   \u2713 Target resolved: ${target.host}:${target.port}`);
  } catch (err) {
    checks.push({ name: "Target resolution", status: "error", detail: err.message });
    console.log(`   \u2717 Target resolution failed: ${err.message}`);
    if (!targetArg) {
      console.log(`      Hint: Provide a target with: udb doctor <ip:port>`);
    }
  }
  if (target) {
    console.log("5. Testing TCP connectivity...");
    try {
      const reachable = await probeTcp(target);
      if (reachable) {
        checks.push({ name: "TCP connectivity", status: "ok", detail: `${target.host}:${target.port}` });
        console.log(`   \u2713 TCP port reachable: ${target.host}:${target.port}`);
      } else {
        checks.push({ name: "TCP connectivity", status: "error", detail: "Connection refused" });
        console.log(`   \u2717 TCP connection refused`);
      }
    } catch (err) {
      checks.push({ name: "TCP connectivity", status: "error", detail: err.message });
      console.log(`   \u2717 TCP connectivity failed: ${err.message}`);
    }
    console.log("6. Querying device info...");
    try {
      const info = await getInfo(target);
      checks.push({ name: "Device info", status: "ok", detail: `${info.name} v${info.version}` });
      console.log(`   \u2713 Device: ${info.name} v${info.version} (protocol ${info.protocol})`);
      console.log(`      Platform: ${info.platform}/${info.arch}`);
      console.log(`      Pairing mode: ${info.pairingMode}`);
    } catch (err) {
      checks.push({ name: "Device info", status: "error", detail: err.message });
      console.log(`   \u2717 Device info query failed: ${err.message}`);
    }
    console.log("7. Checking authentication...");
    try {
      const statusResult = await status(target);
      checks.push({ name: "Authentication", status: "ok", detail: "Authenticated" });
      console.log(`   \u2713 Authenticated successfully`);
      console.log(`      Paired clients on device: ${statusResult.pairedCount}`);
    } catch (err) {
      if (err instanceof AuthError) {
        checks.push({ name: "Authentication", status: "warning", detail: "Not paired" });
        console.log(`   \u26A0 Not paired with this device`);
        console.log(`      Fix: udb pair ${target.host}:${target.port}`);
      } else {
        checks.push({ name: "Authentication", status: "error", detail: err.message });
        console.log(`   \u2717 Authentication check failed: ${err.message}`);
      }
    }
  }
  console.log("\n\u{1F4CB} Summary:");
  const errorCount = checks.filter((c) => c.status === "error").length;
  const warningCount = checks.filter((c) => c.status === "warning").length;
  const okCount = checks.filter((c) => c.status === "ok").length;
  if (errorCount === 0 && warningCount === 0) {
    console.log(`   \u2713 All ${okCount} checks passed!`);
  } else {
    console.log(`   ${okCount} passed, ${warningCount} warnings, ${errorCount} errors`);
  }
  if (json) {
    console.log("\n" + JSON.stringify({ checks, summary: { ok: okCount, warnings: warningCount, errors: errorCount } }, null, 2));
  }
}
async function main() {
  if (cmd === "devices") return devicesCmd();
  if (cmd === "pair") return pairCmd();
  if (cmd === "unpair") return unpairCmd();
  if (cmd === "shell") return shellCmd();
  if (cmd === "exec") return execCmd();
  if (cmd === "push") return pushCmd();
  if (cmd === "pull") return pullCmd();
  if (cmd === "status") return statusCmd();
  if (cmd === "services") return servicesCmd();
  if (cmd === "info") return infoCmd();
  if (cmd === "ping") return pingCmd();
  if (cmd === "doctor") return doctorCmd();
  if (cmd === "list-paired") return listPairedCmd();
  if (cmd === "daemon" && rest[0] === "start") return daemonStart();
  if (cmd === "daemon" && rest[0] === "stop") return daemonStop();
  if (cmd === "daemon" && rest[0] === "status") return daemonStatus();
  if (cmd === "config" && rest[0] === "show") return configShowCmd();
  if (cmd === "connect") return connectCmd();
  if (cmd === "context" && rest[0] === "list") return contextListCmd();
  if (cmd === "context" && rest[0] === "add") return contextAddCmd();
  if (cmd === "context" && rest[0] === "use") return contextUseCmd();
  if (cmd === "group" && rest[0] === "list") return groupListCmd();
  if (cmd === "group" && rest[0] === "add") return groupAddCmd();
  if (cmd === "group" && rest[0] === "exec") return groupExecCmd();
  if (cmd === "inventory") return inventoryCmd();
  if (cmd === "start-server") return daemonStart();
  if (cmd === "kill-server") return daemonStop();
  console.log(`Universal Device Bridge (UDB) v0.8.5
udb-style device access for embedded systems, MCUs, and simulators.

Usage:
  udb devices                       Discover devices on the network
  udb connect <target>              Connect to device (sets as default)
  udb shell                         Interactive shell
  udb exec "<cmd>"                  Run command
  udb push <src> <dst>              Push file to device
  udb pull <src> <dst>              Pull file from device

Device Management:
  udb status [target]               Get device status
  udb info [target]                 Get device info
  udb ping [target]                 Check device connectivity
  udb doctor [target]               Diagnose connection issues
  udb pair <target>                 Pair with a device
  udb unpair <target> [--all|--fp]  Unpair from a device
  udb list-paired <target>          List paired clients

Context Management:
  udb context list                  List saved contexts
  udb context add <name> <target>   Save a named context
  udb context use <name>            Set current context

Fleet Management:
  udb group list                    List device groups
  udb group add <name> <targets...> Create a group
  udb group exec <name> "<cmd>"     Run command on group
  udb inventory                     Export fleet inventory

Configuration:
  udb config show                   Show current config
  udb daemon start|stop|status      Manage local daemon
  udb start-server                  Alias for 'daemon start'
  udb kill-server                   Alias for 'daemon stop'

Target Formats:
  ip:port                           TCP connection (10.0.0.1:9910)
  tcp://ip:port                     Explicit TCP URL
  serial://path?baud=115200         Serial connection (MCU)
  device-name                       Discover by name

Flags:
  --json, -j                        Output in JSON format

Exit Codes:
  0 = success, 1 = error, 2 = usage error

Quick Start:
  udb connect 10.0.0.1:9910    # Connect to device
  udb shell                          # Open shell
  udb exec "ls /tmp"                 # Run command
  udb push ./app /opt/app            # Deploy file

For more information, visit:
Documentation: https://github.com/Mukesh-SCS/universal_device_bridge
`);
}
main().catch((err) => handleError(err));
