#!/usr/bin/env node

/**
 * UDB CLI - Command-line interface for Universal Device Bridge
 * 
 * This is a thin wrapper over @udb/client. All core logic is in the client module
 * so it can be reused programmatically.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";

import {
  discoverDevices,
  parseTarget,
  resolveTarget,
  probeTcp,
  status,
  getServices,
  getInfo,
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
  UdbError,
  AuthError,
  ConnectionError,
  CommandError
} from "@udb/client";

import {
  createGroup,
  getGroup,
  listGroups,
  addToGroup,
  removeFromGroup,
  deleteGroup,
  setLabels,
  getLabels,
  findByLabels,
  execOnGroup,
  execByLabels,
  exportInventory
  } from "../../client/src/fleet.js";

const [, , cmd, ...rest] = process.argv;
const UDB_DIR = path.join(os.homedir(), ".udb");
const PID_FILE = path.join(UDB_DIR, "udbd.pid");
const json = rest.includes("--json") || rest.includes("-j");

/* ===================== Exit Codes ===================== */
const EXIT = {
  SUCCESS: 0,
  ERROR: 1,
  USAGE: 2
};

/* ===================== helpers ===================== */

/**
 * Print error to stderr and exit with appropriate code.
 * In JSON mode, outputs structured error object.
 */
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

/**
 * Print usage error and exit with code 2.
 */
function usageError(msg) {
  die(msg, EXIT.USAGE);
}

function hasFlag(name) {
  return rest.includes(name);
}

function getFlagValue(name) {
  const i = rest.indexOf(name);
  return i !== -1 ? rest[i + 1] : undefined;
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prompt user to select a device interactively.
 * @param {Array} devices - List of discovered devices
 * @returns {Promise<object>} Selected device
 */
async function promptDeviceSelection(devices) {
  console.log("\nMultiple devices found:");
  devices.forEach((d, i) => {
    const name = d.name || "unknown";
    const target = `${d.host}:${d.port}`;
    console.log(`  [${i + 1}] ${name.padEnd(20)} ${target}`);
  });
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question("Select device [1]: ", (answer) => {
      rl.close();
      const idx = answer.trim() === "" ? 0 : parseInt(answer, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= devices.length) {
        resolve(devices[0]); // Default to first
      } else {
        resolve(devices[idx]);
      }
    });
  });
}

/**
 * Resolve target with interactive device selection for TTY.
 * If multiple devices found and running in TTY mode (not --json), prompt user.
 * @param {string|object} maybeTarget - Optional explicit target
 * @returns {Promise<object>} Resolved target { host, port }
 */
async function resolveTargetInteractive(maybeTarget) {
  try {
    return await resolveTarget(maybeTarget);
  } catch (err) {
    // Handle multiple devices case interactively
    if (err.code === "AMBIGUOUS_TARGET" && process.stdout.isTTY && !json) {
      const devices = await discoverDevices();
      const selected = await promptDeviceSelection(devices);
      
      // Save as current context for convenience
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
      message: `Device requires pairing.\nRun: udb pair <target>`, 
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

/**
 * Handle error and exit with appropriate code.
 * In JSON mode, outputs structured error object.
 */
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

/* ===================== daemon commands ===================== */

async function daemonStart() {
  fs.mkdirSync(UDB_DIR, { recursive: true });

  if (fs.existsSync(PID_FILE)) {
    const pid = Number(fs.readFileSync(PID_FILE, "utf8"));
    if (isRunning(pid)) {
      console.log(`Daemon already running (pid ${pid})`);
      return;
    }
    fs.unlinkSync(PID_FILE);
  }

  const daemonPath = path.resolve("daemon/linux/udbd.js");

  const child = spawn("node", [daemonPath, "--pairing", "auto"], {
    detached: true,
    stdio: "ignore"
  });

  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid));
  console.log(`Daemon started (pid ${child.pid})`);
}

async function daemonStop() {
  if (!fs.existsSync(PID_FILE)) {
    console.log("Daemon not running");
    return;
  }

  const pid = Number(fs.readFileSync(PID_FILE, "utf8"));
  try {
    process.kill(pid);
    console.log(`Daemon stopped (pid ${pid})`);
  } catch {
    console.log("Daemon process already dead");
  }

  fs.unlinkSync(PID_FILE);
}

async function daemonStatus() {
  if (!fs.existsSync(PID_FILE)) {
    console.log("Daemon not running");
    return;
  }

  const pid = Number(fs.readFileSync(PID_FILE, "utf8"));
  console.log(
    isRunning(pid)
      ? `Daemon running (pid ${pid})`
      : "PID file exists but daemon not running"
  );
}

/* ===================== core commands ===================== */

async function statusCmd() {
  try {
    let targetArg = undefined;
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
    let targetArg = undefined;
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
        const capsStr = Object.entries(caps)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
        console.log(`  ${name}: ${capsStr}`);
      }
    }
  } catch (err) {
    handleError(err);
  }
}

async function infoCmd() {
  try {
    let targetArg = undefined;
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
    let targetArg = undefined;
    if (rest.length > 0 && rest[0].includes(":")) {
      targetArg = rest[0];
    }

    const target = await resolveTarget(targetArg);
    
    // Import ping from client
    const { ping } = await import("@udb/client");
    const result = await ping(target);

    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`✔ Pong from ${result.name}`);
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

    // Merge contexts
    const merged = new Map();

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

    // Add context-only devices
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

    // Probe online status and fetch device type for online devices
    const deviceList = [...merged.values()];
    await Promise.all(
      deviceList.map(async (d) => {
        if (d.source === "context") {
          d.online = await probeTcp({ host: d.host, port: d.port });
        }
        // Try to get device info for online devices
        if (d.online) {
          try {
            const info = await getInfo({ host: d.host, port: d.port });
            d.type = info.deviceType || (info.simulator ? "simulator" : "unknown");
            if (!d.name && info.name) d.name = info.name;
          } catch {
            // Info might require auth, just leave type as unknown
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
      // Table-style output
      console.log(`${"NAME".padEnd(16)} ${"TYPE".padEnd(16)} ${"TARGET".padEnd(24)} STATUS`);
      console.log("─".repeat(70));
      for (const d of deviceList) {
        const name = (d.name || d.context || "-").substring(0, 15).padEnd(16);
        const type = (d.type || "unknown").padEnd(16);
        const target = `${d.host}:${d.port}`.padEnd(24);
        const status = d.online ? "online" : "offline";
        console.log(`${name} ${type} ${target} ${status}`);
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
      targetArg = undefined;
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
      targetArg = undefined;
    }

    const target = await resolveTargetInteractive(targetArg);
    
    // Import streaming client
    const { createStreamingSession } = await import("@udb/client");
    
    const session = await createStreamingSession(target);
    
    // Open shell service
    const shellStream = await session.openService("shell", {
      pty: true,
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24
    });

    // Set up terminal - only if TTY
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      restoreTerminal = true;
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    // Forward resize events
    const onResize = () => {
      if (process.stdout.isTTY) {
        shellStream.resize(process.stdout.columns || 80, process.stdout.rows || 24);
      }
    };
    process.stdout.on("resize", onResize);

    // Forward stdin to shell
    const onStdin = (chunk) => {
      try {
        shellStream.write(chunk);
      } catch (err) {
        // Stream might be closed, just ignore
      }
    };
    process.stdin.on("data", onStdin);

    // Forward shell output to stdout
    const onData = (chunk) => {
      process.stdout.write(chunk);
    };
    shellStream.on("data", onData);

    // Handle stream close
    const onClose = () => {
      cleanup();
      process.exit(0);
    };
    shellStream.on("close", onClose);

    // Handle stream error
    const onError = (err) => {
      cleanup();
      if (err.message && err.message !== "stream_closed") {
        console.error(`Shell error: ${err.message}`);
      }
      process.exit(1);
    };
    shellStream.on("error", onError);

    // Cleanup function
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
      // Resolve by name
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

    // Verify device is reachable
    const reachable = await probeTcp(target);
    if (!reachable) {
      die(`Cannot connect to ${target.host}:${target.port}`);
    }

    // Get device info
    let deviceName = "";
    try {
      const info = await getInfo(target);
      deviceName = info.name || "";
    } catch {
      // Info might require auth, continue anyway
    }

    // Save as default context (udb-style: connect sets current device)
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
    const { getConfig } = await import("@udb/client");
    const cfg = getConfig();

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

/* ===================== context commands ===================== */

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
        `Context "${ctxName}" added → ${target.host}:${target.port}  name=${result.name}`
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
        `Using context "${name}" → ${ctx.host}:${ctx.port}  name=${result.name}`
      );
    }
  } catch (err) {
    handleError(err);
  }
}

/* ===================== fleet commands ===================== */

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
      console.log(`✓ Created group "${groupName}" with ${result.deviceCount} device(s)`);
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
          console.log(`\n✓ ${target}:`);
          if (res.result.stdout) console.log(res.result.stdout.trim());
        } else {
          console.log(`\n✗ ${target}: ${res.error.message}`);
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
      console.log(`Generated: ${inventory.timestamp}\n`);

      console.log("Groups:");
      for (const [name, devices] of Object.entries(inventory.groups)) {
        console.log(`  ${name}:`);
        for (const d of devices) {
          const labels = Object.entries(d.labels)
            .map(([k, v]) => `${k}=${v}`)
            .join(" ");
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
    function parsePushArgs(args) {
      if (args.length === 2) {
        return { target: null, src: args[0], dst: args[1] };
      }
      if (args.length === 3) {
        return { target: args[0], src: args[1], dst: args[2] };
      }
      usageError('Usage: udb push [target] <src> <dst>');
    }

    const { target, src, dst } = parsePushArgs(rest);
    if (!src || !dst) usageError('Usage: udb push [target] <src> <dst>');
    if (!fs.existsSync(src)) usageError(`Local file not found: ${src}`);
    const resolvedTarget = await resolveTarget(target);
    const stats = fs.statSync(src);
    console.log(`Pushing ${src} (${stats.size} bytes) to ${resolvedTarget.host}:${dst}...`);
    const result = await push(resolvedTarget, src, dst);
    console.log(`✓ Pushed ${result.bytes} bytes successfully`);
  } catch (err) {
    handleError(err);
  }
}

async function pullCmd() {
  try {
    function parsePullArgs(args) {
      if (args.length === 2) {
        return { target: null, src: args[0], dst: args[1] };
      }
      if (args.length === 3) {
        return { target: args[0], src: args[1], dst: args[2] };
      }
      usageError('Usage: udb pull [target] <src> <dst>');
    }

    const { target, src, dst } = parsePullArgs(rest);
    if (!src || !dst) usageError('Usage: udb pull [target] <src> <dst>');
    const resolvedTarget = await resolveTarget(target);
    console.log(`Pulling ${src} from ${resolvedTarget.host} to ${dst}...`);
    const result = await pull(resolvedTarget, src, dst);
    console.log(`✓ Pulled ${result.bytes} bytes successfully to ${dst}`);
  } catch (err) {
    handleError(err);
  }
}

/* ===================== doctor command ===================== */

async function doctorCmd() {
  const checks = [];
  const isFirstRun = hasFlag("--first-run");
  let targetArg = rest.find(r => r.includes(":") && !r.startsWith("--"));

  if (isFirstRun) {
    console.log("🚀 UDB First-Run Setup\n");
    console.log("Welcome to UDB! Let's make sure everything is ready.\n");
  } else {
    console.log("🔍 UDB Doctor - Diagnosing connectivity and configuration\n");
  }

  // Check 1: Local config
  console.log("1. Checking local configuration...");
  try {
    const configDir = path.join(os.homedir(), ".udb");
    if (fs.existsSync(configDir)) {
      checks.push({ name: "Config directory", status: "ok", detail: configDir });
      console.log(`   ✓ Config directory exists: ${configDir}`);
    } else {
      checks.push({ name: "Config directory", status: "warning", detail: "Not created yet" });
      console.log(`   ⚠ Config directory not found (will be created on first use)`);
    }
  } catch (err) {
    checks.push({ name: "Config directory", status: "error", detail: err.message });
    console.log(`   ✗ Config directory check failed: ${err.message}`);
  }

  // Check 2: Client keypair
  console.log("2. Checking client keypair...");
  try {
    const keyDir = path.join(os.homedir(), ".udb");
    const pubKeyPath = path.join(keyDir, "id_ed25519.pub");
    const privKeyPath = path.join(keyDir, "id_ed25519");

    if (fs.existsSync(pubKeyPath) && fs.existsSync(privKeyPath)) {
      checks.push({ name: "Client keypair", status: "ok", detail: pubKeyPath });
      console.log(`   ✓ Client keypair found`);
    } else if (isFirstRun) {
      // Auto-generate keys on first run
      console.log(`   ⚠ No keypair found. Generating...`);
      const { loadOrCreateClientKeypair, fingerprintPublicKeyPem } = await import("@udb/protocol/src/crypto.js");
      const { publicKeyPem } = loadOrCreateClientKeypair();
      const fp = fingerprintPublicKeyPem(publicKeyPem);
      checks.push({ name: "Client keypair", status: "ok", detail: `Generated, fingerprint: ${fp}` });
      console.log(`   ✓ Keypair generated! Fingerprint: ${fp}`);
    } else {
      checks.push({ name: "Client keypair", status: "warning", detail: "Not created yet" });
      console.log(`   ⚠ Client keypair not found (will be created on first operation)`);
    }
  } catch (err) {
    checks.push({ name: "Client keypair", status: "error", detail: err.message });
    console.log(`   ✗ Keypair check failed: ${err.message}`);
  }

  // Check 3: Contexts
  console.log("3. Checking contexts...");
  try {
    const contexts = getContexts();
    const count = Object.keys(contexts).length;
    const currentCtx = getCurrentContextName();

    if (count > 0) {
      checks.push({ name: "Contexts", status: "ok", detail: `${count} contexts, current: ${currentCtx || "none"}` });
      console.log(`   ✓ ${count} context(s) configured, current: ${currentCtx || "(none)"}`);
    } else {
      checks.push({ name: "Contexts", status: "info", detail: "No contexts saved" });
      console.log(`   ℹ No contexts saved yet`);
    }
  } catch (err) {
    checks.push({ name: "Contexts", status: "error", detail: err.message });
    console.log(`   ✗ Context check failed: ${err.message}`);
  }

  // Check 4: Target resolution
  console.log("4. Resolving target...");
  let target = null;
  try {
    target = await resolveTarget(targetArg);
    checks.push({ name: "Target resolution", status: "ok", detail: `${target.host}:${target.port}` });
    console.log(`   ✓ Target resolved: ${target.host}:${target.port}`);
  } catch (err) {
    checks.push({ name: "Target resolution", status: "error", detail: err.message });
    console.log(`   ✗ Target resolution failed: ${err.message}`);
    if (!targetArg) {
      console.log(`      Hint: Provide a target with: udb doctor <ip:port>`);
    }
  }

  // Check 5: TCP connectivity
  if (target) {
    console.log("5. Testing TCP connectivity...");
    try {
      const reachable = await probeTcp(target);
      if (reachable) {
        checks.push({ name: "TCP connectivity", status: "ok", detail: `${target.host}:${target.port}` });
        console.log(`   ✓ TCP port reachable: ${target.host}:${target.port}`);
      } else {
        checks.push({ name: "TCP connectivity", status: "error", detail: "Connection refused" });
        console.log(`   ✗ TCP connection refused`);
      }
    } catch (err) {
      checks.push({ name: "TCP connectivity", status: "error", detail: err.message });
      console.log(`   ✗ TCP connectivity failed: ${err.message}`);
    }

    // Check 6: Device info (pre-auth)
    console.log("6. Querying device info...");
    try {
      const info = await getInfo(target);
      checks.push({ name: "Device info", status: "ok", detail: `${info.name} v${info.version}` });
      console.log(`   ✓ Device: ${info.name} v${info.version} (protocol ${info.protocol})`);
      console.log(`      Platform: ${info.platform}/${info.arch}`);
      console.log(`      Pairing mode: ${info.pairingMode}`);
    } catch (err) {
      checks.push({ name: "Device info", status: "error", detail: err.message });
      console.log(`   ✗ Device info query failed: ${err.message}`);
    }

    // Check 7: Authentication
    console.log("7. Checking authentication...");
    try {
      const statusResult = await status(target);
      checks.push({ name: "Authentication", status: "ok", detail: "Authenticated" });
      console.log(`   ✓ Authenticated successfully`);
      console.log(`      Paired clients on device: ${statusResult.pairedCount}`);
    } catch (err) {
      if (err instanceof AuthError) {
        checks.push({ name: "Authentication", status: "warning", detail: "Not paired" });
        console.log(`   ⚠ Not paired with this device`);
        console.log(`      Fix: udb pair ${target.host}:${target.port}`);
      } else {
        checks.push({ name: "Authentication", status: "error", detail: err.message });
        console.log(`   ✗ Authentication check failed: ${err.message}`);
      }
    }
  }

  // Summary
  console.log("\n📋 Summary:");
  const errorCount = checks.filter(c => c.status === "error").length;
  const warningCount = checks.filter(c => c.status === "warning").length;
  const okCount = checks.filter(c => c.status === "ok").length;

  if (errorCount === 0 && warningCount === 0) {
    console.log(`   ✓ All ${okCount} checks passed!`);
  } else {
    console.log(`   ${okCount} passed, ${warningCount} warnings, ${errorCount} errors`);
  }

  if (json) {
    console.log("\n" + JSON.stringify({ checks, summary: { ok: okCount, warnings: warningCount, errors: errorCount } }, null, 2));
  }
}

/* ===================== main ===================== */

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

  // udb-compatible aliases
  if (cmd === "start-server") return daemonStart();
  if (cmd === "kill-server") return daemonStop();

  console.log(`Universal Device Bridge (UDB) v0.8.1
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
