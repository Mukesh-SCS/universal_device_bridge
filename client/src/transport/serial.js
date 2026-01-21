/**
 * Serial Transport Implementation
 * 
 * Transport layer implementation for serial port connections.
 * Uses the same protocol and framing as TCP - proving transport independence.
 * 
 * This wraps the 'serialport' npm package to provide the Transport interface.
 * 
 * Serial is MCU/embedded-friendly and validates the transport abstraction.
 */

import { Transport } from "./transport.js";

/**
 * @typedef {Object} SerialTransportOptions
 * @property {string} path - Serial port path (e.g., COM3, /dev/ttyUSB0)
 * @property {number} [baudRate=115200] - Baud rate
 * @property {number} [timeout=10000] - Connection timeout in ms
 * @property {Object} [serialport] - Optional serialport module (for dependency injection)
 */

export class SerialTransport extends Transport {
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
    this.timeout = options.timeout || 10000;
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
      // Dynamic import to keep serialport optional
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
}

/**
 * Factory function to create SerialTransport
 * @param {string} path - Serial port path
 * @param {Object} [options] - Additional options
 * @returns {SerialTransport}
 */
export function createSerialTransport(path, options = {}) {
  return new SerialTransport({
    path,
    ...options
  });
}

/**
 * Parse a serial target string
 * Formats:
 *   serial://COM3
 *   serial:///dev/ttyUSB0
 *   serial://COM3?baud=9600
 * 
 * @param {string} target - Serial target URL
 * @returns {Object} Parsed target { path, baudRate }
 */
export function parseSerialTarget(target) {
  if (!target.startsWith("serial://")) {
    throw new Error("Invalid serial target. Use: serial://PORT or serial:///dev/ttyUSB0");
  }
  
  const url = new URL(target);
  const baudRate = url.searchParams.get("baud");
  
  // For serial:///dev/ttyUSB0, pathname is /dev/ttyUSB0
  // For serial://COM3, hostname is COM3, pathname is empty or /
  let path;
  if (url.pathname && url.pathname.length > 1) {
    // Has a real pathname (Linux paths like /dev/ttyUSB0)
    path = url.pathname;
  } else if (url.hostname) {
    // Windows-style COM port in hostname
    path = url.hostname;
  } else {
    throw new Error("Serial path required. Use: serial://COM3 or serial:///dev/ttyUSB0");
  }
  
  if (!path) {
    throw new Error("Serial path required. Use: serial://COM3 or serial:///dev/ttyUSB0");
  }
  
  return {
    path: path.startsWith("/") ? path : (process.platform === "win32" ? path : "/" + path),
    baudRate: baudRate ? parseInt(baudRate, 10) : 115200
  };
}

export default SerialTransport;
