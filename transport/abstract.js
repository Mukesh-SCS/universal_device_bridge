/**
 * Abstract Transport Interface
 * 
 * Base class for all UDB transport implementations.
 * Transports handle the physical/link layer communication.
 */

/**
 * @abstract
 */
export class AbstractTransport {
  /**
   * Connect to the remote endpoint
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error("connect() must be implemented by subclass");
  }

  /**
   * Disconnect from the remote endpoint
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error("disconnect() must be implemented by subclass");
  }

  /**
   * Send data to the remote endpoint
   * @param {Uint8Array|Buffer} data - Data to send
   * @returns {Promise<void>}
   */
  async send(data) {
    throw new Error("send() must be implemented by subclass");
  }

  /**
   * Register callback for received data
   * @param {Function} callback - Called with (data: Uint8Array) when data is received
   */
  onReceive(callback) {
    throw new Error("onReceive() must be implemented by subclass");
  }

  /**
   * Check if transport is connected
   * @returns {boolean}
   */
  isConnected() {
    return false;
  }

  /**
   * Get transport type name
   * @returns {string}
   */
  getType() {
    return "abstract";
  }
}

export default AbstractTransport;
