/**
 * Transport Layer Tests
 * 
 * Tests for transport abstraction (TCP, Serial, etc.)
 * Validates transport independence - same protocol, different wires.
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert";

import {
  Transport,
  TcpTransport,
  createTcpTransport,
  SerialTransport,
  createSerialTransport,
  parseSerialTarget
} from "../src/index.js";

describe("Transport abstraction", () => {
  describe("Transport base class", () => {
    it("should throw on abstract methods", () => {
      const transport = new Transport();
      
      assert.throws(() => transport.write(Buffer.from("test")));
      assert.throws(() => transport.end());
      assert.throws(() => transport.destroy());
      assert.throws(() => transport.isConnected());
    });

    it("should store options", () => {
      const transport = new Transport({ timeout: 5000 });
      
      assert.strictEqual(transport.options.timeout, 5000);
    });

    it("should return abstract as type", () => {
      const transport = new Transport();
      
      assert.strictEqual(transport.getType(), "abstract");
    });

    it("should register callbacks", () => {
      const transport = new Transport();
      const onData = () => {};
      const onError = () => {};
      const onClose = () => {};
      
      transport.onData(onData);
      transport.onError(onError);
      transport.onClose(onClose);
      
      assert.strictEqual(transport._dataCallback, onData);
      assert.strictEqual(transport._errorCallback, onError);
      assert.strictEqual(transport._closeCallback, onClose);
    });
  });

  describe("TcpTransport", () => {
    it("should require host and port", () => {
      assert.throws(() => new TcpTransport({}), /requires host and port/);
      assert.throws(() => new TcpTransport({ host: "127.0.0.1" }), /requires host and port/);
      assert.throws(() => new TcpTransport({ port: 9910 }), /requires host and port/);
    });

    it("should create with valid options", () => {
      const transport = new TcpTransport({ host: "127.0.0.1", port: 9910 });
      
      assert.strictEqual(transport.host, "127.0.0.1");
      assert.strictEqual(transport.port, 9910);
      assert.strictEqual(transport.timeout, 10000); // default
    });

    it("should use custom timeout", () => {
      const transport = new TcpTransport({ 
        host: "127.0.0.1", 
        port: 9910, 
        timeout: 5000 
      });
      
      assert.strictEqual(transport.timeout, 5000);
    });

    it("should return tcp as type", () => {
      const transport = new TcpTransport({ host: "127.0.0.1", port: 9910 });
      
      assert.strictEqual(transport.getType(), "tcp");
    });

    it("should report not connected before connect()", () => {
      const transport = new TcpTransport({ host: "127.0.0.1", port: 9910 });
      
      assert.strictEqual(transport.isConnected(), false);
    });

    it("should provide remote info", () => {
      const transport = new TcpTransport({ host: "10.0.0.1", port: 9910 });
      const info = transport.getRemoteInfo();
      
      assert.strictEqual(info.host, "10.0.0.1");
      assert.strictEqual(info.port, 9910);
    });
  });

  describe("createTcpTransport factory", () => {
    it("should create transport from target object", () => {
      const transport = createTcpTransport({ host: "10.0.0.1", port: 8080 });
      
      assert.ok(transport instanceof TcpTransport);
      assert.strictEqual(transport.host, "10.0.0.1");
      assert.strictEqual(transport.port, 8080);
    });

    it("should merge additional options", () => {
      const transport = createTcpTransport(
        { host: "10.0.0.1", port: 8080 },
        { timeout: 3000 }
      );
      
      assert.strictEqual(transport.timeout, 3000);
    });
  });
});

describe("SerialTransport", () => {
  describe("constructor", () => {
    it("should require path", () => {
      assert.throws(() => new SerialTransport({}), /requires path/);
    });

    it("should create with valid options", () => {
      const transport = new SerialTransport({ path: "COM3" });
      
      assert.strictEqual(transport.path, "COM3");
      assert.strictEqual(transport.baudRate, 115200); // default
      assert.strictEqual(transport.timeout, 10000);   // default
    });

    it("should use custom baud rate", () => {
      const transport = new SerialTransport({ 
        path: "/dev/ttyUSB0", 
        baudRate: 9600 
      });
      
      assert.strictEqual(transport.baudRate, 9600);
    });

    it("should return serial as type", () => {
      const transport = new SerialTransport({ path: "COM3" });
      
      assert.strictEqual(transport.getType(), "serial");
    });

    it("should report not connected before connect()", () => {
      const transport = new SerialTransport({ path: "COM3" });
      
      assert.strictEqual(transport.isConnected(), false);
    });

    it("should provide port info", () => {
      const transport = new SerialTransport({ 
        path: "/dev/ttyUSB0",
        baudRate: 57600 
      });
      const info = transport.getPortInfo();
      
      assert.strictEqual(info.path, "/dev/ttyUSB0");
      assert.strictEqual(info.baudRate, 57600);
      assert.strictEqual(info.isOpen, false);
    });
  });

  describe("createSerialTransport factory", () => {
    it("should create transport from path", () => {
      const transport = createSerialTransport("COM3");
      
      assert.ok(transport instanceof SerialTransport);
      assert.strictEqual(transport.path, "COM3");
    });

    it("should merge options", () => {
      const transport = createSerialTransport("/dev/ttyUSB0", {
        baudRate: 19200,
        timeout: 5000
      });
      
      assert.strictEqual(transport.baudRate, 19200);
      assert.strictEqual(transport.timeout, 5000);
    });
  });
});

describe("parseSerialTarget", () => {
  it("should parse Windows port", () => {
    const target = parseSerialTarget("serial://COM3");
    
    // On Windows, path stays as-is
    assert.ok(target.path.includes("COM3"));
    assert.strictEqual(target.baudRate, 115200);
  });

  it("should parse Linux port", () => {
    const target = parseSerialTarget("serial:///dev/ttyUSB0");
    
    assert.strictEqual(target.path, "/dev/ttyUSB0");
    assert.strictEqual(target.baudRate, 115200);
  });

  it("should parse custom baud rate", () => {
    const target = parseSerialTarget("serial://COM3?baud=9600");
    
    assert.strictEqual(target.baudRate, 9600);
  });

  it("should throw on invalid format", () => {
    assert.throws(() => parseSerialTarget("tcp://10.0.0.1:9910"));
    assert.throws(() => parseSerialTarget("COM3"));
  });

  it("should throw on missing path", () => {
    assert.throws(() => parseSerialTarget("serial://"));
  });
});

describe("Transport interface consistency", () => {
  it("should have same methods on TCP and Serial", () => {
    const tcp = new TcpTransport({ host: "127.0.0.1", port: 9910 });
    const serial = new SerialTransport({ path: "COM3" });
    
    // Both should have all Transport interface methods
    const methods = [
      "connect",
      "write",
      "end",
      "destroy",
      "onData",
      "onError",
      "onClose",
      "isConnected",
      "getType"
    ];
    
    for (const method of methods) {
      assert.strictEqual(typeof tcp[method], "function", `TCP missing ${method}`);
      assert.strictEqual(typeof serial[method], "function", `Serial missing ${method}`);
    }
  });

  it("should both extend Transport base class", () => {
    const tcp = new TcpTransport({ host: "127.0.0.1", port: 9910 });
    const serial = new SerialTransport({ path: "COM3" });
    
    assert.ok(tcp instanceof Transport);
    assert.ok(serial instanceof Transport);
  });
});
