import dgram from "node:dgram";
import net from "node:net";
import fs from "node:fs";
import { encodeFrame, createFrameDecoder } from "@udb/protocol/src/framing.js";
import { MSG } from "@udb/protocol/src/messages.js";
import {
  loadOrCreateClientKeypair,
  fingerprintPublicKeyPem,
  signNonce
} from "@udb/protocol/src/crypto.js";

/* ===================== argv ===================== */

const [,, cmd, ...rest] = process.argv;

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

function parseTarget(t) {
  const [host, portStr] = String(t || "").split(":");
  const port = Number(portStr || "9910");
  if (!host) die("target required: <ip>:<port>");
  return { host, port };
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



/* ===================== commands ===================== */
async function statusCmd() {
  const target = parseTarget(rest[0]);
  const res = await tcpRequest(target, [{ type: MSG.STATUS }]);
  if (res.msg?.type === MSG.STATUS_RESULT) {
    console.log(`Device: ${res.msg.deviceName}`);
    console.log(`Pairing mode: ${res.msg.pairingMode}`);
    console.log(`Exec enabled: ${res.msg.execEnabled}`);
    console.log(`Paired clients: ${res.msg.pairedCount}`);
    return;
  }
  if (res.msg?.type === MSG.AUTH_REQUIRED) {
    die("Not authorized. Run: udb pair <ip>:<port>");
  }
  if (res.msg?.type === MSG.ERROR) die(res.msg.error);
  console.log(res.msg);
}

async function listPairedCmd() {
  const target = parseTarget(rest[0]);
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

  sock.bind(0, () => {
    sock.setBroadcast(true);
    sock.send(Buffer.from("UDB_DISCOVER_V1"), 9909, "255.255.255.255");
  });

  const found = new Set();

  sock.on("message", (msg, rinfo) => {
    try {
      const j = JSON.parse(msg.toString());
      const key = `${rinfo.address}:${j.tcpPort}`;
      if (!found.has(key)) {
        found.add(key);
        console.log(`${key}  name=${j.name}`);
      }
    } catch {}
  });

  setTimeout(() => sock.close(), 1200);
}

async function pair() {
  const target = parseTarget(rest[0]);
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
  const target = parseTarget(rest[0]);

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
  const target = parseTarget(rest[0]);
  const command = rest.slice(1).join(" ").trim();
  if (!command) die('Usage: exec <ip>:<port> "<cmd>"');

  const res = await tcpRequest(target, [{ type: MSG.EXEC, cmd: command }]);

  if (res.msg?.type === MSG.EXEC_RESULT) {
    process.stdout.write(res.msg.stdout || "");
    if (res.msg.stderr) process.stderr.write(res.msg.stderr);
    process.exit(res.msg.code || 0);
  }

  if (res.msg?.type === MSG.AUTH_REQUIRED) die("Not authorized");
  if (res.msg?.type === MSG.ERROR) die(res.msg.error);
}

/* ===================== main ===================== */

async function main() {
  if (cmd === "devices") return devices();
  if (cmd === "pair") return pair();
  if (cmd === "unpair") return unpair();
  if (cmd === "exec") return execCmd();
  if (cmd === "status") return statusCmd();
  if (cmd === "list-paired") return listPairedCmd();

  console.log(`Usage:
  node cli/src/udb.js devices
  node cli/src/udb.js pair <ip>:<port>
  node cli/src/udb.js exec <ip>:<port> "<cmd>"
  node cli/src/udb.js unpair <ip>:<port>
  node cli/src/udb.js unpair <ip>:<port> --fp <fingerprint>
  node cli/src/udb.js unpair <ip>:<port> --all
  node cli/src/udb.js status <ip>:<port>
  node cli/src/udb.js list-paired <ip>:<port>
`);
}

main().catch(e => die(e.message));
