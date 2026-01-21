/**
 * Client Core Tests
 * 
 * Tests for @udb/client core functionality.
 */

import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  parseTarget,
  UdbError,
  AuthError,
  ConnectionError,
  CommandError,
  getConfig,
  setConfig,
  getContexts,
  addContext,
  getContext,
  removeContext,
  getCurrentContextName,
  setCurrentContext
} from "../src/index.js";

describe("parseTarget", () => {
  it("should parse ip:port format", () => {
    const target = parseTarget("10.0.0.1:9910");
    
    assert.strictEqual(target.host, "10.0.0.1");
    assert.strictEqual(target.port, 9910);
  });

  it("should parse tcp:// URL format", () => {
    const target = parseTarget("tcp://10.0.0.1:8080");
    
    assert.strictEqual(target.host, "10.0.0.1");
    assert.strictEqual(target.port, 8080);
  });

  it("should parse localhost", () => {
    const target = parseTarget("127.0.0.1:9910");
    
    assert.strictEqual(target.host, "127.0.0.1");
    assert.strictEqual(target.port, 9910);
  });

  it("should parse hostname with port", () => {
    const target = parseTarget("device.local:9910");
    
    assert.strictEqual(target.host, "device.local");
    assert.strictEqual(target.port, 9910);
  });

  it("should throw on invalid format - missing port", () => {
    assert.throws(() => {
      parseTarget("10.0.0.1");
    }, UdbError);
  });

  it("should throw on invalid format - empty string", () => {
    assert.throws(() => {
      parseTarget("");
    }, UdbError);
  });

  it("should throw on invalid tcp URL - missing port", () => {
    assert.throws(() => {
      parseTarget("tcp://10.0.0.1");
    }, UdbError);
  });
});

describe("Error classes", () => {
  describe("UdbError", () => {
    it("should create error with code and details", () => {
      const err = new UdbError("Test error", "TEST_CODE", { extra: "info" });
      
      assert.strictEqual(err.message, "Test error");
      assert.strictEqual(err.code, "TEST_CODE");
      assert.strictEqual(err.name, "UdbError");
      assert.deepStrictEqual(err.details, { extra: "info" });
    });

    it("should default details to empty object", () => {
      const err = new UdbError("Test", "CODE");
      assert.deepStrictEqual(err.details, {});
    });
  });

  describe("AuthError", () => {
    it("should create auth error", () => {
      const err = new AuthError("Not authorized");
      
      assert.strictEqual(err.message, "Not authorized");
      assert.strictEqual(err.code, "AUTH_FAILED");
      assert.strictEqual(err.name, "AuthError");
    });
  });

  describe("ConnectionError", () => {
    it("should create connection error with details", () => {
      const err = new ConnectionError("Connection refused", { host: "10.0.0.1" });
      
      assert.strictEqual(err.message, "Connection refused");
      assert.strictEqual(err.code, "CONNECTION_FAILED");
      assert.strictEqual(err.name, "ConnectionError");
      assert.strictEqual(err.details.host, "10.0.0.1");
    });
  });

  describe("CommandError", () => {
    it("should create command error with exit code", () => {
      const err = new CommandError("Command failed", 127);
      
      assert.strictEqual(err.message, "Command failed");
      assert.strictEqual(err.code, 127);
      assert.strictEqual(err.name, "CommandError");
    });
  });
});

describe("Config management", () => {
  const originalConfig = path.join(os.homedir(), ".udb", "config.json");
  let backupConfig = null;

  before(() => {
    // Backup existing config if present
    if (fs.existsSync(originalConfig)) {
      backupConfig = fs.readFileSync(originalConfig, "utf8");
    }
  });

  after(() => {
    // Restore original config
    if (backupConfig) {
      fs.writeFileSync(originalConfig, backupConfig);
    }
  });

  it("should get and set config", () => {
    const testConfig = { testKey: "testValue", timestamp: Date.now() };
    setConfig(testConfig);
    
    const retrieved = getConfig();
    assert.strictEqual(retrieved.testKey, testConfig.testKey);
  });
});

describe("Context management", () => {
  const originalConfig = path.join(os.homedir(), ".udb", "config.json");
  let backupConfig = null;

  before(() => {
    // Backup existing config if present
    if (fs.existsSync(originalConfig)) {
      backupConfig = fs.readFileSync(originalConfig, "utf8");
    }
    // Start with clean config
    setConfig({});
  });

  after(() => {
    // Restore original config
    if (backupConfig) {
      fs.writeFileSync(originalConfig, backupConfig);
    }
  });

  it("should add and get context", () => {
    addContext("test-lab", { host: "10.0.0.1", port: 9910, name: "lab-device" });
    
    const ctx = getContext("test-lab");
    assert.strictEqual(ctx.host, "10.0.0.1");
    assert.strictEqual(ctx.port, 9910);
    assert.strictEqual(ctx.name, "lab-device");
  });

  it("should list all contexts", () => {
    setConfig({ contexts: {} }); // Reset
    addContext("ctx1", { host: "10.0.0.1", port: 9910 });
    addContext("ctx2", { host: "10.0.0.2", port: 9910 });
    
    const contexts = getContexts();
    assert.ok("ctx1" in contexts);
    assert.ok("ctx2" in contexts);
  });

  it("should set and get current context", () => {
    setConfig({ contexts: {} }); // Reset
    addContext("primary", { host: "10.0.0.1", port: 9910 });
    
    setCurrentContext("primary");
    
    assert.strictEqual(getCurrentContextName(), "primary");
  });

  it("should throw when setting non-existent context", () => {
    assert.throws(() => {
      setCurrentContext("does-not-exist");
    }, UdbError);
  });

  it("should remove context", () => {
    setConfig({ contexts: {} }); // Reset
    addContext("to-remove", { host: "1.2.3.4", port: 9910 });
    
    assert.ok(getContext("to-remove"));
    
    removeContext("to-remove");
    
    assert.strictEqual(getContext("to-remove"), null);
  });

  it("should return null for non-existent context", () => {
    const ctx = getContext("never-existed");
    assert.strictEqual(ctx, null);
  });
});
