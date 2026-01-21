/**
 * UDB USB Transport
 * 
 * USB transport implementation for Universal Device Bridge.
 * Supports USB serial (CDC/ACM) devices for direct device connections.
 * 
 * This is useful for:
 * - Devices without network connectivity
 * - Secure/air-gapped environments
 * - Initial device setup before network config
 * - MCU/embedded devices with USB
 */

import { EventEmitter } from "node:events";
import { AbstractTransport } from "../abstract.js";

/**
 * USB Transport States
 */
export const UsbState = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ERROR: "error"
};

/**
 * USB Transport Implementation
 * 
 * Implements the AbstractTransport interface for USB serial connections.
 */
export class UsbTransport extends AbstractTransport {
  constructor(options = {}) {
    super();
    
    this.options = {
      vendorId: options.vendorId || null,
      productId: options.productId || null,
      path: options.path || null,
      baudRate: options.baudRate || 115200,
      dataBits: options.dataBits || 8,
      stopBits: options.stopBits || 1,
      parity: options.parity || "none",
      ...options
    };

    this.state = UsbState.DISCONNECTED;
    this.port = null;
    this.receiveCallback = null;
    this.buffer = Buffer.alloc(0);
    this.emitter = new EventEmitter();
  }

  /**
   * Get current connection state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.state === UsbState.CONNECTED;
  }

  /**
   * List available USB serial ports
   * @returns {Promise<Array>} List of available ports
   */
  static async listPorts() {
    try {
      // Try to load serialport dynamically
      const { SerialPort } = await import("serialport");
      const ports = await SerialPort.list();
      
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || "Unknown",
        serialNumber: port.serialNumber || null,
        vendorId: port.vendorId || null,
        productId: port.productId || null,
        pnpId: port.pnpId || null
      }));
    } catch (err) {
      if (err.code === "ERR_MODULE_NOT_FOUND") {
        throw new Error(
          "USB transport requires 'serialport' package. Install with: npm install serialport"
        );
      }
      throw err;
    }
  }

  /**
   * Find UDB devices by known vendor/product IDs
   * @returns {Promise<Array>} List of potential UDB devices
   */
  static async findUdbDevices() {
    const ports = await UsbTransport.listPorts();
    
    // Known UDB-compatible device identifiers
    // This list can be extended as more devices are supported
    const knownDevices = [
      { vendorId: "2341", productId: "0043" }, // Arduino Uno
      { vendorId: "2341", productId: "8036" }, // Arduino Leonardo
      { vendorId: "10c4", productId: "ea60" }, // CP210x USB-UART
      { vendorId: "0403", productId: "6001" }, // FTDI FT232
      { vendorId: "1a86", productId: "7523" }, // CH340
      { vendorId: "067b", productId: "2303" }, // Prolific PL2303
      { vendorId: "239a" },                     // Adafruit
      { vendorId: "303a" },                     // Espressif (ESP32)
      { vendorId: "1fc9" },                     // NXP
      { vendorId: "0483" },                     // STMicroelectronics
    ];

    return ports.filter(port => {
      if (!port.vendorId) return false;
      
      const vid = port.vendorId.toLowerCase();
      const pid = port.productId?.toLowerCase();
      
      return knownDevices.some(known => {
        if (known.productId) {
          return known.vendorId === vid && known.productId === pid;
        }
        return known.vendorId === vid;
      });
    });
  }

  /**
   * Connect to USB device
   */
  async connect() {
    if (this.state === UsbState.CONNECTED) {
      return;
    }

    this.state = UsbState.CONNECTING;

    try {
      const { SerialPort } = await import("serialport");

      // Determine which port to use
      let portPath = this.options.path;

      if (!portPath) {
        // Auto-detect if vendorId/productId specified
        if (this.options.vendorId) {
          const ports = await UsbTransport.listPorts();
          const match = ports.find(p => {
            const vidMatch = p.vendorId?.toLowerCase() === this.options.vendorId.toLowerCase();
            if (this.options.productId) {
              return vidMatch && p.productId?.toLowerCase() === this.options.productId.toLowerCase();
            }
            return vidMatch;
          });

          if (!match) {
            throw new Error(`No USB device found with vendor ID: ${this.options.vendorId}`);
          }
          portPath = match.path;
        } else {
          // Try to find any UDB device
          const devices = await UsbTransport.findUdbDevices();
          if (devices.length === 0) {
            throw new Error("No compatible USB devices found");
          }
          if (devices.length > 1) {
            throw new Error(
              `Multiple USB devices found. Specify path explicitly: ${devices.map(d => d.path).join(", ")}`
            );
          }
          portPath = devices[0].path;
        }
      }

      // Open the serial port
      this.port = new SerialPort({
        path: portPath,
        baudRate: this.options.baudRate,
        dataBits: this.options.dataBits,
        stopBits: this.options.stopBits,
        parity: this.options.parity,
        autoOpen: false
      });

      // Set up event handlers
      this.port.on("data", (data) => {
        this.buffer = Buffer.concat([this.buffer, data]);
        this._processBuffer();
      });

      this.port.on("error", (err) => {
        this.state = UsbState.ERROR;
        this.emitter.emit("error", err);
      });

      this.port.on("close", () => {
        this.state = UsbState.DISCONNECTED;
        this.emitter.emit("close");
      });

      // Open connection
      await new Promise((resolve, reject) => {
        this.port.open((err) => {
          if (err) {
            this.state = UsbState.ERROR;
            reject(err);
          } else {
            this.state = UsbState.CONNECTED;
            resolve();
          }
        });
      });

      this.emitter.emit("connect");

    } catch (err) {
      this.state = UsbState.ERROR;
      
      if (err.code === "ERR_MODULE_NOT_FOUND") {
        throw new Error(
          "USB transport requires 'serialport' package. Install with: npm install serialport"
        );
      }
      throw err;
    }
  }

  /**
   * Disconnect from USB device
   */
  async disconnect() {
    if (this.state === UsbState.DISCONNECTED) {
      return;
    }

    return new Promise((resolve, reject) => {
      if (!this.port) {
        this.state = UsbState.DISCONNECTED;
        resolve();
        return;
      }

      this.port.close((err) => {
        this.state = UsbState.DISCONNECTED;
        this.port = null;
        this.buffer = Buffer.alloc(0);
        
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Send data over USB
   * @param {Uint8Array|Buffer} data - Data to send
   */
  async send(data) {
    if (this.state !== UsbState.CONNECTED || !this.port) {
      throw new Error("Not connected");
    }

    const buffer = Buffer.from(data);

    return new Promise((resolve, reject) => {
      this.port.write(buffer, (err) => {
        if (err) {
          reject(err);
        } else {
          this.port.drain((drainErr) => {
            if (drainErr) {
              reject(drainErr);
            } else {
              resolve();
            }
          });
        }
      });
    });
  }

  /**
   * Register callback for received data
   * @param {Function} callback - Called with received data
   */
  onReceive(callback) {
    this.receiveCallback = callback;
  }

  /**
   * Register event listener
   * @param {string} event - Event name (connect, close, error)
   * @param {Function} callback - Event handler
   */
  on(event, callback) {
    this.emitter.on(event, callback);
    return this;
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    this.emitter.off(event, callback);
    return this;
  }

  /**
   * Process received buffer and emit complete frames
   * @private
   */
  _processBuffer() {
    // UDB uses length-prefixed frames (4 bytes length + payload)
    while (this.buffer.length >= 4) {
      const frameLength = this.buffer.readUInt32BE(0);
      
      if (frameLength <= 0 || frameLength > 8 * 1024 * 1024) {
        // Invalid frame - reset buffer
        this.buffer = Buffer.alloc(0);
        this.emitter.emit("error", new Error("Invalid frame length"));
        return;
      }

      if (this.buffer.length < 4 + frameLength) {
        // Incomplete frame - wait for more data
        return;
      }

      // Extract complete frame
      const frame = this.buffer.slice(0, 4 + frameLength);
      this.buffer = this.buffer.slice(4 + frameLength);

      if (this.receiveCallback) {
        this.receiveCallback(frame);
      }
    }
  }
}

/**
 * USB Transport Factory
 * 
 * Helper for creating USB transport connections.
 */
export class UsbTransportFactory {
  /**
   * Create transport by port path
   */
  static byPath(path, options = {}) {
    return new UsbTransport({ ...options, path });
  }

  /**
   * Create transport by vendor/product ID
   */
  static byVendorProduct(vendorId, productId, options = {}) {
    return new UsbTransport({ ...options, vendorId, productId });
  }

  /**
   * Auto-detect and create transport
   */
  static async autoDetect(options = {}) {
    const devices = await UsbTransport.findUdbDevices();
    
    if (devices.length === 0) {
      return null;
    }
    
    if (devices.length === 1) {
      return new UsbTransport({ ...options, path: devices[0].path });
    }

    // Return first device but warn about multiple
    console.warn(`Multiple USB devices found: ${devices.map(d => d.path).join(", ")}`);
    return new UsbTransport({ ...options, path: devices[0].path });
  }
}

export default UsbTransport;
