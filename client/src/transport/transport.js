/**
 * Transport Interface
 * 
 * Abstract interface for transport implementations. This allows the UDB client
 * to work with different transport layers (TCP, USB, Serial, etc.) without
 * changing the protocol or session logic.
 * 
 * All transports must implement these methods:
 * - connect(): Promise<void> - Establish connection
 * - write(data: Buffer): void - Send data
 * - end(): void - Close connection gracefully
 * - destroy(): void - Force close connection
 * - onData(callback): void - Register data handler
 * - onError(callback): void - Register error handler
 * - onClose(callback): void - Register close handler
 * - isConnected(): boolean - Check connection state
 */

/**
 * @typedef {Object} TransportOptions
 * @property {number} [timeout] - Connection timeout in ms
 */

/**
 * @callback DataCallback
 * @param {Buffer} data - Received data
 */

/**
 * @callback ErrorCallback
 * @param {Error} error - Error object
 */

/**
 * @callback CloseCallback
 */

/**
 * Abstract Transport class
 * Subclasses must implement all methods
 */
export class Transport {
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
}

export default Transport;
