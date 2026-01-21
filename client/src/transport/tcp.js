/**
 * TCP Transport Implementation
 * 
 * Transport layer implementation for TCP/IP connections.
 * This wraps Node.js net.Socket to provide the Transport interface.
 */

import net from "node:net";
import { Transport } from "./transport.js";

/**
 * @typedef {Object} TcpTransportOptions
 * @property {string} host - Host to connect to
 * @property {number} port - Port to connect to
 * @property {number} [timeout=10000] - Connection timeout in ms
 */

export class TcpTransport extends Transport {
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
    this.timeout = options.timeout || 10000;
    this.socket = null;
    this._connected = false;
  }

  /**
   * Establish TCP connection
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({
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
}

/**
 * Factory function to create TcpTransport from target object
 * @param {Object} target - Target with host and port
 * @param {Object} [options] - Additional options
 * @returns {TcpTransport}
 */
export function createTcpTransport(target, options = {}) {
  return new TcpTransport({
    host: target.host,
    port: target.port,
    ...options
  });
}

export default TcpTransport;
