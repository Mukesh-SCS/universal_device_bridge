/**
 * CLI Integration Tests
 * 
 * Tests for the UDB CLI commands.
 * These tests verify CLI argument parsing and command routing.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, "../src/udb.js");

/**
 * Run CLI command and capture output
 */
function runCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [CLI_PATH, ...args], {
      timeout: options.timeout || 5000,
      env: { ...process.env, ...options.env }
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });

    proc.on("error", reject);
  });
}

describe("CLI Help", () => {
  it("should show help when no command given", async () => {
    const result = await runCli([]);
    
    assert.ok(result.stdout.includes("Universal Device Bridge"));
    assert.ok(result.stdout.includes("udb devices"));
    assert.ok(result.stdout.includes("udb pair"));
    assert.ok(result.stdout.includes("udb exec"));
  });

  it("should show help with unknown command", async () => {
    const result = await runCli(["unknown-command"]);
    
    assert.ok(result.stdout.includes("Universal Device Bridge"));
  });
});

describe("CLI Argument Parsing", () => {
  describe("devices command", () => {
    it("should run devices command", async () => {
      const result = await runCli(["devices"], { timeout: 3000 });
      
      // Should complete without error (may find no devices)
      assert.strictEqual(result.code, 0);
    });

    it("should support --json flag", async () => {
      const result = await runCli(["devices", "--json"], { timeout: 3000 });
      
      // Output should be valid JSON
      assert.strictEqual(result.code, 0);
      assert.doesNotThrow(() => {
        JSON.parse(result.stdout);
      });
    });
  });

  describe("context commands", () => {
    it("should list contexts", async () => {
      const result = await runCli(["context", "list"]);
      
      assert.strictEqual(result.code, 0);
    });

    it("should list contexts as JSON", async () => {
      const result = await runCli(["context", "list", "--json"]);
      
      assert.strictEqual(result.code, 0);
      assert.doesNotThrow(() => {
        JSON.parse(result.stdout);
      });
    });
  });

  describe("group commands", () => {
    it("should list groups", async () => {
      const result = await runCli(["group", "list"]);
      
      assert.strictEqual(result.code, 0);
    });

    it("should list groups as JSON", async () => {
      const result = await runCli(["group", "list", "--json"]);
      
      assert.strictEqual(result.code, 0);
      assert.doesNotThrow(() => {
        JSON.parse(result.stdout);
      });
    });
  });

  describe("inventory command", () => {
    it("should export inventory", async () => {
      const result = await runCli(["inventory"]);
      
      assert.strictEqual(result.code, 0);
      assert.ok(result.stdout.includes("Inventory") || result.stdout.includes("Groups"));
    });

    it("should export inventory as JSON", async () => {
      const result = await runCli(["inventory", "--json"]);
      
      assert.strictEqual(result.code, 0);
      const inventory = JSON.parse(result.stdout);
      assert.ok(inventory.timestamp);
      assert.ok(inventory.groups);
    });
  });

  describe("config command", () => {
    it("should show config", async () => {
      const result = await runCli(["config", "show"]);
      
      assert.strictEqual(result.code, 0);
    });

    it("should show config as JSON", async () => {
      const result = await runCli(["config", "show", "--json"]);
      
      assert.strictEqual(result.code, 0);
      assert.doesNotThrow(() => {
        JSON.parse(result.stdout);
      });
    });
  });
});

describe("CLI Error Handling", () => {
  describe("exec command", () => {
    it("should error without command", async () => {
      const result = await runCli(["exec"]);
      
      assert.notStrictEqual(result.code, 0);
      assert.ok(result.stderr.includes("Usage") || result.stderr.includes("exec"));
    });
  });

  describe("pair command", () => {
    it("should handle unreachable target gracefully", async () => {
      // Use a non-routable IP to ensure quick failure
      const result = await runCli(["pair", "192.0.2.1:9910"], { timeout: 15000 });
      
      assert.notStrictEqual(result.code, 0);
    });
  });

  describe("push command", () => {
    it("should error without enough arguments", async () => {
      const result = await runCli(["push"]);
      
      assert.notStrictEqual(result.code, 0);
      assert.ok(result.stderr.includes("Usage"));
    });

    it("should error with non-existent local file", async () => {
      const result = await runCli(["push", "/nonexistent/file.txt", "/remote/path.txt"]);
      
      assert.notStrictEqual(result.code, 0);
      assert.ok(result.stderr.includes("not found") || result.stderr.includes("No devices"));
    });
  });

  describe("pull command", () => {
    it("should error without enough arguments", async () => {
      const result = await runCli(["pull"]);
      
      assert.notStrictEqual(result.code, 0);
      assert.ok(result.stderr.includes("Usage"));
    });
  });

  describe("context use command", () => {
    it("should error with non-existent context", async () => {
      const result = await runCli(["context", "use", "nonexistent-context-12345"]);
      
      assert.notStrictEqual(result.code, 0);
      assert.ok(result.stderr.includes("No such context"));
    });
  });
});

describe("CLI Daemon Commands", () => {
  it("should show daemon status", async () => {
    const result = await runCli(["daemon", "status"]);
    
    assert.strictEqual(result.code, 0);
    assert.ok(
      result.stdout.includes("running") || 
      result.stdout.includes("not running") ||
      result.stdout.includes("Daemon")
    );
  });
});
