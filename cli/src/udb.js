import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import dgram from "node:dgram";
import net from "node:net";

import { encodeFrame, createFrameDecoder } from "@udb/protocol/src/framing.js";
import { MSG } from "@udb/protocol/src/messages.js";
import {
  loadOrCreateClientKeypair,
  fingerprintPublicKeyPem,
  signNonce
} from "@udb/protocol/src/crypto.js";



/* ===================== argv ===================== */

const [,, cmd, ...rest] = process.argv;
const UDB_DIR = path.join(os.homedir(), ".udb");
const PID_FILE = path.join(UDB_DIR, "udbd.pid");
const json = rest.includes("--json");
const CONFIG_FILE = path.join(os.homedir(), ".udb", "config.json");



/* ===================== helpers ===================== */
async function discoverOnce(timeoutMs = 1200) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket("udp4");
    const found = new Map();

    sock.on("message", (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === "udb_announce") {
          const key = `${rinfo.address}:${data.port}`;
          found.set(key, {
            host: rinfo.address,
            port: data.port,
            name: data.name
          });
        }
      } catch {}
    });

    sock.bind(() => {
      sock.setBroadcast(true);
      sock.send(
        Buffer.from(JSON.stringify({ type: "udb_discover" })),
        9909,
        "255.255.255.255"
      );
    });

    setTimeout(() => {
      sock.close();
      resolve([...found.values()]);
    }, timeoutMs);
  });
}

async function resolveTarget(maybeTarget) {
  if (maybeTarget) {
    return parseTarget(maybeTarget);
  }

  const devices = await discoverOnce();

  if (devices.length === 0) {
  const last = loadLastTarget();
  if (last) {
    return last;
  }
  die("No devices found");
  }


  if (devices.length > 1) {
    die("Multiple devices found. Run: udb devices");
  }

  return devices[0];
}

function saveLastTarget(target) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify({ lastTarget: target }, null, 2)
  );
}

function loadLastTarget() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE)).lastTarget;
  } catch {
    return null;
  }
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}


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

function parseTarget(t) {
  const [host, portStr] = String(t || "").split(":");
  const port = Number(portStr || "9910");
  if (!host) die("target required: <ip>:<port>");
  return { host, port };
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/* ===================== TCP helper ===================== */

async function tcpRequest(
  target,
  messages,
  { onStream, keepOpen = false, preAuth = false } = {}
) {
  const { publicKeyPem } = loadOrCreateClientKeypair();

  return new Promise((resolve, reject) => {
    const sock = net.createConnection(target);
    let sent = false;

    const sendQueued = () => {
      if (sent) return;
      sent = true;
      for (const m of messages) sock.write(encodeFrame(m));
    };

    const decoder = createFrameDecoder((m) => {
      if (onStream) onStream(m, sock);

      if (m.type === MSG.AUTH_CHALLENGE) {
        const { privateKeyPem } = loadOrCreateClientKeypair();
        sock.write(
          encodeFrame({
            type: MSG.AUTH_RESPONSE,
            signatureB64: signNonce({ privateKeyPem, nonce: m.nonce })
          })
        );
        return;
      }

      if (m.type === MSG.AUTH_OK) {
        sendQueued();
        return;
      }

      if (
        m.type === MSG.EXEC_RESULT ||
        m.type === MSG.PAIR_OK ||
        m.type === MSG.PAIR_DENIED ||
        m.type === MSG.UNPAIR_OK ||
        m.type === MSG.STATUS_RESULT ||
        m.type === MSG.LIST_PAIRED_RESULT ||
        m.type === MSG.AUTH_REQUIRED ||
        m.type === MSG.AUTH_FAIL ||
        m.type === MSG.ERROR
      ) {
        resolve({ msg: m });
        if (!keepOpen) sock.end();
      }
    });

    sock.on("connect", () => {
      sock.write(
        encodeFrame({
          type: MSG.HELLO,
          clientName: "udb-cli",
          pubKey: publicKeyPem
        })
      );

      // Pairing must be sent BEFORE auth completes
      if (preAuth) {
        sendQueued();
      }
    });

    sock.on("data", decoder);
    sock.on("error", reject);
  });
}

/* ===================== daemon Start ===================== */
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

//daemon stop 
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

//daemon status 
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


/* ===================== commands ===================== */
async function statusCmd() {
  let targetArg = undefined;

  // Only treat arg as target if it looks like ip:port
  if (rest.length > 0 && rest[0].includes(":")) {
    targetArg = rest[0];
  }

  const target = await resolveTarget(targetArg);
  const res = await tcpRequest(target, [{ type: MSG.STATUS }]);

  if (res.msg?.type === MSG.STATUS_RESULT) {
    const data = {
      name: res.msg.deviceName,
      pairing: res.msg.pairingMode,
      exec: res.msg.execEnabled,
      paired: res.msg.pairedCount
    };

    // remember last working target
    saveLastTarget(target);

    if (json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log(`Device: ${data.name}`);
    console.log(`Pairing mode: ${data.pairing}`);
    console.log(`Exec enabled: ${data.exec}`);
    console.log(`Paired clients: ${data.paired}`);
    return;
  }

  if (res.msg?.type === MSG.AUTH_REQUIRED) {
    die("Not authorized. Run: udb pair <ip>:<port>");
  }

  if (res.msg?.type === MSG.ERROR) {
    die(res.msg.error);
  }
}

async function listPairedCmd() {
  const  target = await resolveTarget(rest[0]);
  const res = await tcpRequest(target, [{ type: MSG.LIST_PAIRED }]);
  if (res.msg?.type === MSG.LIST_PAIRED_RESULT) {
    if (!res.msg.devices.length) {
      console.log("No paired clients.");
      return;
    }
    for (const d of res.msg.devices) {
      console.log(`${d.fp}  name=${d.name}  added=${d.addedAt}`);
    }
    return;
  }
  if (res.msg?.type === MSG.AUTH_REQUIRED) {
    die("Not authorized. Run: udb pair <ip>:<port>");
  }
  if (res.msg?.type === MSG.ERROR) die(res.msg.error);
  console.log(res.msg);
}

async function devices() {
  const sock = dgram.createSocket("udp4");
  const found = new Map();

  sock.bind(0, () => {
    sock.setBroadcast(true);
    sock.send(Buffer.from("UDB_DISCOVER_V1"), 9909, "255.255.255.255");
  });

  sock.on("message", (msg, rinfo) => {
    try {
      const j = JSON.parse(msg.toString());
      const key = `${rinfo.address}:${j.tcpPort}`;

      if (!found.has(key)) {
        found.set(key, {
          host: rinfo.address,
          port: j.tcpPort,
          name: j.name
        });
      }
    } catch {}
  });

  setTimeout(() => {
    sock.close();

    const devices = [...found.values()];

    // 🔹 JSON MODE
    if (json) {
      console.log(JSON.stringify(devices, null, 2));
      return;
    }

    // 🔹 HUMAN MODE (existing behavior)
    for (const d of devices) {
      console.log(`${d.host}:${d.port}  name=${d.name}`);
    }
  }, 1200);
}


async function pair() {
  const  target = await resolveTarget(rest[0]);
  const { publicKeyPem } = loadOrCreateClientKeypair();
  const fp = fingerprintPublicKeyPem(publicKeyPem);

  const res = await tcpRequest(
  target,
  [{ type: MSG.PAIR_REQUEST }],
  { preAuth: true }
);


  if (res.msg?.type === MSG.PAIR_OK) {
    console.log(`Paired OK fp=${fp}`);
    return;
  }

  if (res.msg?.type === MSG.PAIR_DENIED) die("Pair denied");
  if (res.msg?.type === MSG.ERROR) die(res.msg.error);

  console.log(res.msg);
}

async function unpair() {
  const  target = await resolveTarget(rest[0]);

  const payload = { type: MSG.UNPAIR_REQUEST };

  if (hasFlag("--all")) payload.all = true;
  if (getFlagValue("--fp")) payload.fp = getFlagValue("--fp");

  if (payload.all && payload.fp) {
    die("Use only one of --all or --fp <fingerprint>");
  }

  const res = await tcpRequest(target, [payload]);

  if (res.msg?.type === MSG.UNPAIR_OK) {
    if (res.msg.scope === "all") {
      console.log(`Unpaired ALL clients (removed=${res.msg.removed})`);
    } else if (res.msg.removed) {
      console.log(`Unpaired fp=${res.msg.fp}`);
    } else {
      console.log(`No pairing found for fp=${res.msg.fp}`);
    }
    return;
  }

  if (res.msg?.type === MSG.AUTH_REQUIRED) {
    die("Not authorized. Run: udb pair <ip>:<port>");
  }

  if (res.msg?.type === MSG.ERROR) die(res.msg.error);

  console.log(res.msg);
}

async function execCmd() {
  let targetArg;
  let command;

  // Case 1: first argument looks like ip:port
  if (rest[0] && rest[0].includes(":")) {
    targetArg = rest[0];
    command = rest.slice(1).join(" ").trim();
  } else {
    // Case 2: no explicit target, command starts immediately
    targetArg = undefined;
    command = rest.join(" ").trim();
  }

  if (!command) {
    die('Usage: exec [ip:port] "<cmd>"');
  }

  // Resolve target (explicit or implicit)
  const target = await resolveTarget(targetArg);

  const res = await tcpRequest(target, [
    { type: MSG.EXEC, cmd: command }
  ]);

  if (res.msg?.type === MSG.EXEC_RESULT) {
    saveLastTarget(target);
    if (res.msg.stdout) process.stdout.write(res.msg.stdout);
    if (res.msg.stderr) process.stderr.write(res.msg.stderr);
    process.exit(res.msg.code ?? 0);
  }

  if (res.msg?.type === MSG.AUTH_REQUIRED) {
    die("Not authorized");
  }

  if (res.msg?.type === MSG.ERROR) {
    die(res.msg.error);
  }
}

async function configShowCmd() {
  const cfg = readConfig();

  if (json) {
    console.log(JSON.stringify(cfg, null, 2));
    return;
  }

  const last = cfg.lastTarget;
  if (!last) {
    console.log("No config set yet.");
    console.log('Tip: run `udb exec <ip:port> "whoami"` once, or use `udb connect <ip:port>`.');
    return;
  }

  console.log(`Last target: ${last.host}:${last.port}` + (last.name ? `  name=${last.name}` : ""));
}

async function connectCmd() {
  if (!rest[0]) {
    die("Usage: connect <ip:port | name>");
  }

  const arg = rest[0];

  // Case 1: explicit ip:port
  if (arg.includes(":")) {
    const target = parseTarget(arg);

    const res = await tcpRequest(target, [{ type: MSG.STATUS }]);

    if (res.msg?.type === MSG.STATUS_RESULT) {
      saveLastTarget({
        host: target.host,
        port: target.port,
        name: res.msg.deviceName
      });

      console.log(`Connected to ${target.host}:${target.port}  name=${res.msg.deviceName}`);
      return;
    }

    if (res.msg?.type === MSG.AUTH_REQUIRED) {
      die("Not authorized. Run: udb pair <ip>:<port>");
    }

    if (res.msg?.type === MSG.ERROR) {
      die(res.msg.error);
    }

    die("Failed to connect");
  }

  // Case 2: device name
  let devices = await discoverOnce();

  // If discovery failed, fall back to lastTarget
  if (devices.length === 0) {
    const last = loadLastTarget();
    if (last && last.name === arg) {
      saveLastTarget(last);
      console.log(`Connected to ${last.host}:${last.port}  name=${last.name}`);
      return;
  }
  die("No devices found (discovery unavailable)");
}


  const matches = devices.filter(d => d.name === arg);

  if (matches.length === 0) {
    die(`No device named "${arg}"`);
  }

  if (matches.length > 1) {
    die(`Multiple devices named "${arg}". Use ip:port.`);
  }

  const target = matches[0];

  // Validate target via status
  const res = await tcpRequest(target, [{ type: MSG.STATUS }]);

  if (res.msg?.type === MSG.STATUS_RESULT) {
    saveLastTarget({
      host: target.host,
      port: target.port,
      name: res.msg.deviceName
    });

    console.log(`Connected to ${target.host}:${target.port}  name=${res.msg.deviceName}`);
    return;
  }

  if (res.msg?.type === MSG.AUTH_REQUIRED) {
    die("Not authorized. Run: udb pair <ip>:<port>");
  }

  if (res.msg?.type === MSG.ERROR) {
    die(res.msg.error);
  }

  die("Failed to connect");
}


/* ===================== main ===================== */

async function main() {
  if (cmd === "devices") return devices();
  if (cmd === "pair") return pair();
  if (cmd === "unpair") return unpair();
  if (cmd === "exec") return execCmd();
  if (cmd === "status") return statusCmd();
  if (cmd === "list-paired") return listPairedCmd();
  if (cmd === "daemon" && rest[0] === "start") return daemonStart();
  if (cmd === "daemon" && rest[0] === "stop") return daemonStop();
  if (cmd === "daemon" && rest[0] === "status") return daemonStatus();
  if (cmd === "config" && rest[0] === "show") return configShowCmd();
  if (cmd === "connect") return connectCmd();

  console.log(`Usage:
  node cli/src/udb.js devices
  node cli/src/udb.js pair <ip>:<port>
  node cli/src/udb.js exec <ip>:<port> "<cmd>"
  node cli/src/udb.js unpair <ip>:<port>
  node cli/src/udb.js unpair <ip>:<port> --fp <fingerprint>
  node cli/src/udb.js unpair <ip>:<port> --all
  node cli/src/udb.js status <ip>:<port>
  node cli/src/udb.js list-paired <ip>:<port>
  node cli/src/udb.js daemon start|stop|status
  node cli/src/udb.js config show [--json]
  node cli/src/udb.js connect <ip>:<port>
`);
}

main().catch(e => die(e.message));
