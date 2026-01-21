#!/usr/bin/env node

/**
 * UDB CI Smoke Test
 * 
 * Headless integration test that validates the full UDB workflow:
 * 1. Start simulator daemon
 * 2. Discover device
 * 3. Query services and info
 * 4. Ping device
 * 5. Pair with device
 * 6. Execute command
 * 7. Shutdown daemon
 * 
 * Exit Codes:
 *   0 = All tests passed
 *   1 = Test failure
 *   2 = Setup failure
 * 
 * Usage:
 *   node ci/smoke-test.js [--verbose]
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const VERBOSE = process.argv.includes("--verbose") || process.argv.includes("-v");
const DAEMON_PORT = process.env.UDB_TEST_PORT || 19910; // Use non-standard port for CI
const TARGET = `127.0.0.1:${DAEMON_PORT}`;

let daemonProcess = null;
let testsPassed = 0;
let testsFailed = 0;

/* ===================== Helpers ===================== */

function log(msg) {
  console.log(`[smoke] ${msg}`);
}

function verbose(msg) {
  if (VERBOSE) {
    console.log(`[smoke]   ${msg}`);
  }
}

function pass(name) {
  testsPassed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, error) {
  testsFailed++;
  console.log(`  ✗ ${name}: ${error}`);
}

async function runCommand(args, options = {}) {
  const { expectCode = 0, timeout = 10000 } = options;
  
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["cli/src/udb.js", ...args], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      timeout
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== expectCode) {
        reject(new Error(`Expected exit code ${expectCode}, got ${code}. stderr: ${stderr}`));
      } else {
        resolve({ stdout, stderr, code });
      }
    });

    child.on("error", reject);
  });
}

async function runCommandJson(args, options = {}) {
  const result = await runCommand([...args, "--json"], options);
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Invalid JSON: ${result.stdout}`);
  }
}

/* ===================== Daemon Management ===================== */

async function startDaemon() {
  log("Starting simulator daemon on port " + DAEMON_PORT + "...");
  
  daemonProcess = spawn("node", ["daemon/simulator/udbd-sim.js", "--tcp", String(DAEMON_PORT)], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    detached: false
  });

  daemonProcess.stderr.on("data", (data) => {
    verbose(`daemon stderr: ${data.toString().trim()}`);
  });

  daemonProcess.on("error", (err) => {
    console.error(`Daemon error: ${err.message}`);
  });

  // Wait for daemon to start
  await sleep(500);
  
  if (daemonProcess.exitCode !== null) {
    throw new Error(`Daemon exited early with code ${daemonProcess.exitCode}`);
  }
  
  verbose(`Daemon started (pid ${daemonProcess.pid})`);
}

async function stopDaemon() {
  if (daemonProcess) {
    log("Stopping daemon...");
    daemonProcess.kill("SIGTERM");
    await sleep(200);
    daemonProcess = null;
  }
}

/* ===================== Tests ===================== */

async function testDiscovery() {
  try {
    const result = await runCommand(["devices"]);
    // Discovery may or may not find the simulator depending on UDP broadcast
    // Just verify the command runs without error
    pass("devices command runs");
  } catch (err) {
    fail("devices command", err.message);
  }
}

async function testInfo() {
  try {
    const info = await runCommandJson(["info", TARGET]);
    
    if (!info.name) throw new Error("Missing name");
    if (!info.version) throw new Error("Missing version");
    if (!info.protocol) throw new Error("Missing protocol");
    
    verbose(`Device: ${info.name} v${info.version} (protocol ${info.protocol})`);
    pass("info returns valid data");
  } catch (err) {
    fail("info", err.message);
  }
}

async function testServices() {
  try {
    const result = await runCommandJson(["services", TARGET]);
    
    if (!result.services) throw new Error("Missing services");
    if (!result.services.info) throw new Error("Missing info service");
    if (!result.services.shell) throw new Error("Missing shell service");
    
    verbose(`Services: ${Object.keys(result.services).join(", ")}`);
    pass("services returns valid data");
  } catch (err) {
    fail("services", err.message);
  }
}

async function testPing() {
  try {
    const result = await runCommandJson(["ping", TARGET]);
    
    if (!result.name) throw new Error("Missing name");
    if (typeof result.latencyMs !== "number") throw new Error("Missing latencyMs");
    
    verbose(`Ping: ${result.latencyMs}ms`);
    pass("ping responds");
  } catch (err) {
    fail("ping", err.message);
  }
}

async function testPair() {
  try {
    const result = await runCommandJson(["pair", TARGET]);
    
    if (!result.fingerprint) throw new Error("Missing fingerprint");
    
    verbose(`Paired with fingerprint: ${result.fingerprint}`);
    pass("pair succeeds");
  } catch (err) {
    fail("pair", err.message);
  }
}

async function testExec() {
  try {
    const result = await runCommand(["exec", TARGET, "echo hello"]);
    
    if (!result.stdout.includes("hello")) {
      throw new Error(`Expected 'hello' in output, got: ${result.stdout}`);
    }
    
    pass("exec returns output");
  } catch (err) {
    fail("exec", err.message);
  }
}

async function testExecExitCode() {
  try {
    // Test that non-zero exit code is propagated
    await runCommand(["exec", TARGET, "exit 42"], { expectCode: 42 });
    pass("exec propagates exit code");
  } catch (err) {
    fail("exec exit code", err.message);
  }
}

async function testStatus() {
  try {
    const result = await runCommandJson(["status", TARGET]);
    
    if (!result.name) throw new Error("Missing name");
    if (typeof result.pairedCount !== "number") throw new Error("Missing pairedCount");
    
    pass("status returns valid data");
  } catch (err) {
    fail("status", err.message);
  }
}

async function testListPaired() {
  try {
    const result = await runCommandJson(["list-paired", TARGET]);
    
    if (!Array.isArray(result)) throw new Error("Expected array");
    if (result.length === 0) throw new Error("Expected at least one paired client");
    
    pass("list-paired returns paired clients");
  } catch (err) {
    fail("list-paired", err.message);
  }
}

async function testDoctor() {
  try {
    const result = await runCommand(["doctor", TARGET]);
    // Doctor should run without error
    pass("doctor runs without error");
  } catch (err) {
    fail("doctor", err.message);
  }
}

/* ===================== Main ===================== */

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║     UDB CI Smoke Test                  ║");
  console.log("╚════════════════════════════════════════╝");
  console.log();

  try {
    // Setup
    await startDaemon();
    console.log();

    // Run tests
    log("Running tests against " + TARGET);
    console.log();

    await testDiscovery();
    await testInfo();
    await testServices();
    await testPing();
    await testPair();
    await testStatus();
    await testListPaired();
    await testExec();
    await testExecExitCode();
    await testDoctor();

    console.log();
    
    // Cleanup
    await stopDaemon();
    
    // Results
    console.log("────────────────────────────────────────");
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log("────────────────────────────────────────");
    
    if (testsFailed > 0) {
      console.log("\n❌ SMOKE TEST FAILED");
      process.exit(1);
    } else {
      console.log("\n✅ SMOKE TEST PASSED");
      process.exit(0);
    }
    
  } catch (err) {
    console.error(`\n❌ Setup failed: ${err.message}`);
    await stopDaemon();
    process.exit(2);
  }
}

// Handle cleanup on interrupt
process.on("SIGINT", async () => {
  console.log("\nInterrupted, cleaning up...");
  await stopDaemon();
  process.exit(130);
});

process.on("uncaughtException", async (err) => {
  console.error(`\nUncaught exception: ${err.message}`);
  await stopDaemon();
  process.exit(1);
});

main();
