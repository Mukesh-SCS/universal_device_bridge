import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

export function defaultClientKeyPaths() {
  const dir = path.join(os.homedir(), ".udb");
  return {
    dir,
    priv: path.join(dir, "id_ed25519"),
    pub: path.join(dir, "id_ed25519.pub")
  };
}

export function loadOrCreateClientKeypair() {
  const { dir, priv, pub } = defaultClientKeyPaths();
  ensureDir(dir);

  if (fs.existsSync(priv) && fs.existsSync(pub)) {
    return {
      privateKeyPem: fs.readFileSync(priv, "utf8"),
      publicKeyPem: fs.readFileSync(pub, "utf8")
    };
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });

  fs.writeFileSync(priv, privateKeyPem, { mode: 0o600 });
  fs.writeFileSync(pub, publicKeyPem, { mode: 0o644 });

  return { privateKeyPem, publicKeyPem };
}

export function fingerprintPublicKeyPem(publicKeyPem) {
  const der = crypto.createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  const hash = crypto.createHash("sha256").update(der).digest("hex");
  return hash.slice(0, 16);
}

export function verifySignedNonce({ publicKeyPem, nonce, signatureB64 }) {
  const publicKey = crypto.createPublicKey(publicKeyPem);
  const sig = Buffer.from(signatureB64, "base64");
  return crypto.verify(null, Buffer.from(nonce, "utf8"), publicKey, sig);
}

export function signNonce({ privateKeyPem, nonce }) {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(nonce, "utf8"), privateKey);
  return sig.toString("base64");
}
