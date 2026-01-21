#!/usr/bin/env node

/**
 * UDB Key Management Script
 * 
 * Provides key lifecycle operations:
 *   - Generate new keypairs
 *   - List paired devices
 *   - Revoke device pairings
 *   - Export/import keys
 *   - Rotate keys
 * 
 * Usage:
 *   node scripts/keys.js <command> [options]
 * 
 * Commands:
 *   generate    Generate a new keypair
 *   list        List all paired devices
 *   revoke      Revoke a device pairing
 *   fingerprint Show client key fingerprint
 *   export      Export keys for backup
 *   import      Import keys from backup
 *   rotate      Rotate client keys (invalidates all pairings)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import readline from "node:readline";

const UDB_DIR = path.join(os.homedir(), ".udb");
const KEYS_DIR = path.join(UDB_DIR, "keys");
const KNOWN_DEVICES_DIR = path.join(KEYS_DIR, "known_devices");
const CLIENT_KEY_PATH = path.join(KEYS_DIR, "client.key");
const CLIENT_PUB_PATH = path.join(KEYS_DIR, "client.pub");

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m"
};

function log(msg) { console.log(msg); }
function success(msg) { console.log(`${colors.green}✓${colors.reset} ${msg}`); }
function warn(msg) { console.log(`${colors.yellow}⚠${colors.reset} ${msg}`); }
function error(msg) { console.error(`${colors.red}✗${colors.reset} ${msg}`); }

function ensureDir(dir, mode = 0o700) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode });
  }
}

function setSecurePermissions(filePath, mode = 0o600) {
  try {
    fs.chmodSync(filePath, mode);
  } catch (e) {
    // Windows doesn't support chmod in the same way
    if (process.platform !== "win32") {
      warn(`Could not set permissions on ${filePath}`);
    }
  }
}

function computeFingerprint(publicKey) {
  const hash = crypto.createHash("sha256").update(publicKey).digest();
  // Format as colon-separated hex pairs (first 16 bytes)
  return Array.from(hash.slice(0, 16))
    .map(b => b.toString(16).padStart(2, "0").toUpperCase())
    .join(":");
}

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

// Commands

async function cmdGenerate(force = false) {
  log("\n🔐 Generating new keypair...\n");

  if (fs.existsSync(CLIENT_KEY_PATH) && !force) {
    error("Client keys already exist.");
    log(`   ${colors.dim}Use --force to overwrite (will invalidate pairings)${colors.reset}`);
    process.exit(1);
  }

  ensureDir(KEYS_DIR);
  ensureDir(KNOWN_DEVICES_DIR);

  // Generate ECDSA P-256 keypair
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "P-256",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });

  fs.writeFileSync(CLIENT_KEY_PATH, privateKey);
  setSecurePermissions(CLIENT_KEY_PATH, 0o600);

  fs.writeFileSync(CLIENT_PUB_PATH, publicKey);
  setSecurePermissions(CLIENT_PUB_PATH, 0o644);

  const fingerprint = computeFingerprint(publicKey);

  success("Keypair generated successfully");
  log("");
  log(`   Private key: ${CLIENT_KEY_PATH}`);
  log(`   Public key:  ${CLIENT_PUB_PATH}`);
  log("");
  log(`   Fingerprint: ${colors.blue}${fingerprint}${colors.reset}`);
  log("");
}

async function cmdList() {
  log("\n📋 Paired Devices\n");

  if (!fs.existsSync(KNOWN_DEVICES_DIR)) {
    log("   No paired devices.");
    return;
  }

  const files = fs.readdirSync(KNOWN_DEVICES_DIR).filter(f => f.endsWith(".pub"));

  if (files.length === 0) {
    log("   No paired devices.");
    return;
  }

  for (const file of files) {
    const deviceId = file.replace(".pub", "");
    const pubKeyPath = path.join(KNOWN_DEVICES_DIR, file);
    const pubKey = fs.readFileSync(pubKeyPath, "utf8");
    const fingerprint = computeFingerprint(pubKey);
    const stats = fs.statSync(pubKeyPath);
    const paired = stats.mtime.toLocaleDateString();

    log(`   ${colors.green}●${colors.reset} ${deviceId}`);
    log(`     ${colors.dim}Fingerprint: ${fingerprint.substring(0, 23)}...${colors.reset}`);
    log(`     ${colors.dim}Paired: ${paired}${colors.reset}`);
    log("");
  }

  log(`   Total: ${files.length} device(s)`);
}

async function cmdRevoke(deviceId) {
  if (!deviceId) {
    error("Usage: keys.js revoke <device-id>");
    process.exit(2);
  }

  const pubKeyPath = path.join(KNOWN_DEVICES_DIR, `${deviceId}.pub`);

  if (!fs.existsSync(pubKeyPath)) {
    error(`Device not found: ${deviceId}`);
    process.exit(1);
  }

  const confirmed = await confirm(`Revoke pairing with ${deviceId}?`);
  if (!confirmed) {
    log("Cancelled.");
    return;
  }

  fs.unlinkSync(pubKeyPath);
  success(`Revoked pairing with ${deviceId}`);
  warn("Device will need to be re-paired to reconnect.");
}

async function cmdFingerprint() {
  if (!fs.existsSync(CLIENT_PUB_PATH)) {
    error("No client keys found. Run 'keys.js generate' first.");
    process.exit(1);
  }

  const pubKey = fs.readFileSync(CLIENT_PUB_PATH, "utf8");
  const fingerprint = computeFingerprint(pubKey);

  log("\n🔑 Client Key Fingerprint\n");
  log(`   ${colors.blue}${fingerprint}${colors.reset}`);
  log("");
  log("   Share this with device operators to verify your identity.");
  log("");
}

async function cmdExport(outputPath) {
  if (!outputPath) {
    outputPath = `udb-keys-${Date.now()}.tar`;
  }

  if (!fs.existsSync(CLIENT_KEY_PATH)) {
    error("No keys to export. Run 'keys.js generate' first.");
    process.exit(1);
  }

  log("\n📦 Exporting keys...\n");

  // Simple tar-like format (JSON for simplicity)
  const bundle = {
    version: 1,
    exported: new Date().toISOString(),
    clientKey: fs.readFileSync(CLIENT_KEY_PATH, "utf8"),
    clientPub: fs.readFileSync(CLIENT_PUB_PATH, "utf8"),
    knownDevices: {}
  };

  if (fs.existsSync(KNOWN_DEVICES_DIR)) {
    const files = fs.readdirSync(KNOWN_DEVICES_DIR).filter(f => f.endsWith(".pub"));
    for (const file of files) {
      const deviceId = file.replace(".pub", "");
      bundle.knownDevices[deviceId] = fs.readFileSync(
        path.join(KNOWN_DEVICES_DIR, file), "utf8"
      );
    }
  }

  const content = JSON.stringify(bundle, null, 2);
  fs.writeFileSync(outputPath, content);
  setSecurePermissions(outputPath, 0o600);

  success(`Keys exported to: ${outputPath}`);
  warn("Store this file securely - it contains your private key!");
}

async function cmdImport(inputPath) {
  if (!inputPath) {
    error("Usage: keys.js import <backup-file>");
    process.exit(2);
  }

  if (!fs.existsSync(inputPath)) {
    error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  if (fs.existsSync(CLIENT_KEY_PATH)) {
    const confirmed = await confirm("Existing keys will be replaced. Continue?");
    if (!confirmed) {
      log("Cancelled.");
      return;
    }
  }

  log("\n📥 Importing keys...\n");

  const content = fs.readFileSync(inputPath, "utf8");
  const bundle = JSON.parse(content);

  if (bundle.version !== 1) {
    error(`Unsupported backup version: ${bundle.version}`);
    process.exit(1);
  }

  ensureDir(KEYS_DIR);
  ensureDir(KNOWN_DEVICES_DIR);

  fs.writeFileSync(CLIENT_KEY_PATH, bundle.clientKey);
  setSecurePermissions(CLIENT_KEY_PATH, 0o600);

  fs.writeFileSync(CLIENT_PUB_PATH, bundle.clientPub);
  setSecurePermissions(CLIENT_PUB_PATH, 0o644);

  let deviceCount = 0;
  for (const [deviceId, pubKey] of Object.entries(bundle.knownDevices)) {
    fs.writeFileSync(path.join(KNOWN_DEVICES_DIR, `${deviceId}.pub`), pubKey);
    deviceCount++;
  }

  success("Keys imported successfully");
  log(`   Client keys: restored`);
  log(`   Known devices: ${deviceCount}`);
  log(`   Exported: ${bundle.exported}`);
}

async function cmdRotate() {
  log("\n🔄 Key Rotation\n");

  if (!fs.existsSync(CLIENT_KEY_PATH)) {
    error("No existing keys. Run 'keys.js generate' instead.");
    process.exit(1);
  }

  warn("This will:");
  log("   1. Generate new client keypair");
  log("   2. Invalidate ALL existing device pairings");
  log("   3. Require re-pairing with every device");
  log("");

  const confirmed = await confirm("Proceed with key rotation?");
  if (!confirmed) {
    log("Cancelled.");
    return;
  }

  // Backup old keys
  const backupDir = path.join(UDB_DIR, "keys-backup-" + Date.now());
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(CLIENT_KEY_PATH, path.join(backupDir, "client.key"));
  fs.copyFileSync(CLIENT_PUB_PATH, path.join(backupDir, "client.pub"));
  log(`   Old keys backed up to: ${backupDir}`);

  // Generate new keys
  await cmdGenerate(true);

  // Clear known devices
  if (fs.existsSync(KNOWN_DEVICES_DIR)) {
    const files = fs.readdirSync(KNOWN_DEVICES_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(KNOWN_DEVICES_DIR, file));
    }
    log(`   Removed ${files.length} device pairing(s)`);
  }

  success("Key rotation complete");
  warn("You must now re-pair with all devices.");
}

function printUsage() {
  log(`
UDB Key Management

Usage: node scripts/keys.js <command> [options]

Commands:
  generate [--force]     Generate new client keypair
  list                   List all paired devices
  revoke <device-id>     Revoke a device pairing
  fingerprint            Show client key fingerprint
  export [file]          Export keys for backup
  import <file>          Import keys from backup
  rotate                 Rotate keys (invalidates all pairings)

Key Directory: ${KEYS_DIR}
`);
}

// Main

async function main() {
  const [,, command, ...args] = process.argv;

  switch (command) {
    case "generate":
      await cmdGenerate(args.includes("--force"));
      break;
    case "list":
      await cmdList();
      break;
    case "revoke":
      await cmdRevoke(args[0]);
      break;
    case "fingerprint":
      await cmdFingerprint();
      break;
    case "export":
      await cmdExport(args[0]);
      break;
    case "import":
      await cmdImport(args[0]);
      break;
    case "rotate":
      await cmdRotate();
      break;
    case "--help":
    case "-h":
    case undefined:
      printUsage();
      break;
    default:
      error(`Unknown command: ${command}`);
      printUsage();
      process.exit(2);
  }
}

main().catch(err => {
  error(err.message);
  process.exit(1);
});
