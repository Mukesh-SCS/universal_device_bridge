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
import { spawn } from "node:child_process";

import {
  discoverDevices,
  parseTarget,
  resolveTarget,
  probeTcp,
  status,
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
} from "@udb/client/fleet";

const [, , cmd, ...rest] = process.argv;
const UDB_DIR = path.join(os.homedir(), ".udb");
const PID_FILE = path.join(UDB_DIR, "udbd.pid");
const json = rest.includes("--json");

/* ===================== helpers ===================== */

function die(msg) {
  console.error(msg);
  process.exit(1);
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

function formatError(err) {
  if (err instanceof AuthError) {
    return `Not authorized. Run: udb pair <ip>:<port>`;
  }

  if (err instanceof ConnectionError) {
    return `Connection failed: ${err.message}`;
  }

  if (err instanceof CommandError) {
    return `Command failed with exit code ${err.code}`;
  }

  if (err instanceof UdbError) {
    return `${err.code}: ${err.message}`;
  }

  return `Error: ${err.message}`;
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
    die(formatError(err));
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
        source: "udp"
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
          source: "context"
        });
      }
    }

    // Probe online status for context-only devices
    const deviceList = [...merged.values()];
    await Promise.all(
      deviceList.map(async (d) => {
        if (d.source === "context") {
          d.online = await probeTcp({ host: d.host, port: d.port });
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
            context: d.context,
            online: d.online,
            source: d.source
          })),
          null,
          2
        )
      );
    } else {
      for (const d of deviceList) {
        const ctxInfo = d.context ? `  [context: ${d.context}]` : "";
        const onlineStatus = d.online ? "  [online]" : "  [offline]";
        console.log(`${d.host}:${d.port}  name=${d.name}${ctxInfo}${onlineStatus}`);
      }
    }
  } catch (err) {
    die(formatError(err));
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
    die(formatError(err));
  }
}

async function unpairCmd() {
  try {
    const target = await resolveTarget(rest[0]);
    const options = {};

    if (hasFlag("--all")) options.all = true;
    if (getFlagValue("--fp")) options.fingerprint = getFlagValue("--fp");

    if (options.all && options.fingerprint) {
      die("Use only one of --all or --fp <fingerprint>");
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
    die(formatError(err));
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
    die(formatError(err));
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
      die('Usage: exec [ip:port] "<cmd>"');
    }

    const target = await resolveTarget(targetArg);
    const result = await exec(target, command);

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.exitCode ?? 0);
  } catch (err) {
    if (err instanceof CommandError) {
      process.exit(err.code);
    }
    die(formatError(err));
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

    const target = await resolveTarget(targetArg);
    
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
    die(`Shell failed: ${formatError(err)}`);
  }
}

async function connectCmd() {
  try {
    if (!rest[0]) {
      die("Usage: connect <ip:port | name>");
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
        die(`No device named "${arg}"`);
      }
      if (matches.length > 1) {
        die(`Multiple devices named "${arg}". Use ip:port.`);
      }

      target = matches[0];
    }

    const result = await status(target);

    if (json) {
      console.log(JSON.stringify({ target, result }, null, 2));
    } else {
      console.log(
        `Connected to ${target.host}:${target.port}  name=${result.name}`
      );
    }
  } catch (err) {
    die(formatError(err));
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
    die(formatError(err));
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
    die(formatError(err));
  }
}

async function contextAddCmd() {
  try {
    if (rest.length < 3) {
      die("Usage: context add <name> <ip:port | device-name>");
    }

    const ctxName = rest[1];
    const arg = rest[2];

    let target;

    if (arg.includes(":")) {
      target = parseTarget(arg);
    } else {
      const devices = await discoverDevices();
      if (devices.length === 0) {
        die("No devices found (discovery unavailable)");
      }

      const matches = devices.filter((d) => d.name === arg);
      if (matches.length === 0) {
        die(`No device named "${arg}"`);
      }
      if (matches.length > 1) {
        die(`Multiple devices named "${arg}". Use ip:port.`);
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
    die(formatError(err));
  }
}

async function contextUseCmd() {
  try {
    if (!rest[1]) {
      die("Usage: context use <name>");
    }

    const name = rest[1];
    const ctx = getContext(name);

    if (!ctx) {
      die(`No such context "${name}"`);
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
    die(formatError(err));
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
    die(formatError(err));
  }
}

async function groupAddCmd() {
  try {
    if (rest.length < 3) {
      die("Usage: group add <name> <ip:port> [<ip:port> ...]");
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
    die(formatError(err));
  }
}

async function groupExecCmd() {
  try {
    if (rest.length < 3) {
      die('Usage: group exec <name> "<cmd>"');
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
    die(formatError(err));
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
    die(formatError(err));
  }
}

async function pushCmd() {
  try {
    if (rest.length < 2) {
      die('Usage: udb push [ip:port] <local-path> <remote-path>');
    }

    // Check if first arg is a target
    let target;
    let localPath;
    let remotePath;

    if (rest[0].includes(":")) {
      target = rest[0];
      localPath = rest[1];
      remotePath = rest[2];
    } else {
      target = await resolveTarget();
      localPath = rest[0];
      remotePath = rest[1];
    }

    if (!localPath || !remotePath) {
      die('Usage: udb push [ip:port] <local-path> <remote-path>');
    }

    // Check if local file exists
    if (!fs.existsSync(localPath)) {
      die(`Local file not found: ${localPath}`);
    }

    const stats = fs.statSync(localPath);
    console.log(`Pushing ${localPath} (${stats.size} bytes) to ${target}:${remotePath}...`);

    const result = await push(target, localPath, remotePath);

    console.log(`✓ Pushed ${result.bytes} bytes successfully`);
  } catch (err) {
    die(formatError(err));
  }
}

async function pullCmd() {
  try {
    if (rest.length < 2) {
      die('Usage: udb pull [ip:port] <remote-path> <local-path>');
    }

    // Check if first arg is a target
    let target;
    let remotePath;
    let localPath;

    if (rest[0].includes(":")) {
      target = rest[0];
      remotePath = rest[1];
      localPath = rest[2];
    } else {
      target = await resolveTarget();
      remotePath = rest[0];
      localPath = rest[1];
    }

    if (!remotePath || !localPath) {
      die('Usage: udb pull [ip:port] <remote-path> <local-path>');
    }

    console.log(`Pulling ${remotePath} from ${target} to ${localPath}...`);

    const result = await pull(target, remotePath, localPath);

    console.log(`✓ Pulled ${result.bytes} bytes successfully to ${localPath}`);
  } catch (err) {
    die(formatError(err));
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

  console.log(`Universal Device Bridge (UDB) CLI

Usage:
  udb devices [--json]
  udb status [ip:port] [--json]
  udb pair <ip:port>
  udb unpair <ip:port> [--all | --fp <fingerprint>]
  udb shell [ip:port]
  udb exec [ip:port] "<cmd>"
  udb push [ip:port] <local-path> <remote-path>
  udb pull [ip:port] <remote-path> <local-path>
  udb list-paired <ip:port> [--json]
  udb connect <ip:port | device-name>
  udb context list [--json]
  udb context add <name> <ip:port | device-name>
  udb context use <name>
  udb config show [--json]
  udb daemon start|stop|status

Fleet Management:
  udb group list [--json]
  udb group add <name> <ip:port> [<ip:port> ...]
  udb group exec <name> "<cmd>"
  udb inventory [--json]

Examples:
  udb devices
  udb pair 192.168.1.100:9910
  udb shell
  udb shell 192.168.1.100:9910
  udb exec "whoami"
  udb exec 192.168.1.100:9910 "ls /tmp"
  udb push 192.168.1.100:9910 /tmp/local.txt /tmp/remote.txt
  udb pull 192.168.1.100:9910 /tmp/remote.txt /tmp/local.txt
  udb context add lab 192.168.1.100:9910
  udb context use lab
  udb group add lab 192.168.1.100:9910 192.168.1.101:9910
  udb group exec lab "uname -a"
  udb inventory --json

For programmatic use, import @udb/client:
  import { exec, status, pair, push, pull } from "@udb/client";
  import { createGroup, execOnGroup } from "@udb/client/fleet";
`);
}

main().catch((err) => die(formatError(err)));
