/**
 * Protocol Crypto Tests
 * 
 * Tests for cryptographic functions (Ed25519 keypairs, signing, verification).
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ensureDir,
  defaultClientKeyPaths,
  loadOrCreateClientKeypair,
  fingerprintPublicKeyPem,
  signNonce,
  verifySignedNonce
} from "../src/crypto.js";

describe("ensureDir", () => {
  it("should create directory if it does not exist", () => {
    const testDir = path.join(os.tmpdir(), `udb-test-${Date.now()}`);
    
    assert.ok(!fs.existsSync(testDir));
    ensureDir(testDir);
    assert.ok(fs.existsSync(testDir));
    
    // Cleanup
    fs.rmdirSync(testDir);
  });

  it("should not fail if directory already exists", () => {
    const testDir = path.join(os.tmpdir(), `udb-test-${Date.now()}`);
    
    fs.mkdirSync(testDir);
    assert.ok(fs.existsSync(testDir));
    
    // Should not throw
    ensureDir(testDir);
    assert.ok(fs.existsSync(testDir));
    
    // Cleanup
    fs.rmdirSync(testDir);
  });

  it("should create nested directories", () => {
    const testDir = path.join(os.tmpdir(), `udb-test-${Date.now()}`, "nested", "deep");
    
    ensureDir(testDir);
    assert.ok(fs.existsSync(testDir));
    
    // Cleanup
    fs.rmSync(path.join(os.tmpdir(), `udb-test-${Date.now().toString().slice(0, -3)}`), { 
      recursive: true, 
      force: true 
    });
  });
});

describe("defaultClientKeyPaths", () => {
  it("should return paths in home directory", () => {
    const paths = defaultClientKeyPaths();
    
    assert.ok(paths.dir.includes(".udb"));
    assert.ok(paths.priv.includes("id_ed25519"));
    assert.ok(paths.pub.includes("id_ed25519.pub"));
    assert.ok(paths.priv.startsWith(paths.dir));
    assert.ok(paths.pub.startsWith(paths.dir));
  });
});

describe("keypair operations", () => {
  const testDir = path.join(os.tmpdir(), `udb-crypto-test-${Date.now()}`);
  const originalHome = process.env.HOME || process.env.USERPROFILE;
  
  before(() => {
    // Create isolated test directory
    fs.mkdirSync(testDir, { recursive: true });
  });
  
  after(() => {
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should generate valid Ed25519 keypair", () => {
    // We'll test the keypair structure directly
    const keypair = loadOrCreateClientKeypair();
    
    assert.ok(keypair.privateKeyPem);
    assert.ok(keypair.publicKeyPem);
    assert.ok(keypair.privateKeyPem.includes("BEGIN PRIVATE KEY"));
    assert.ok(keypair.publicKeyPem.includes("BEGIN PUBLIC KEY"));
  });
});

describe("fingerprintPublicKeyPem", () => {
  it("should generate consistent fingerprint", () => {
    const keypair = loadOrCreateClientKeypair();
    
    const fp1 = fingerprintPublicKeyPem(keypair.publicKeyPem);
    const fp2 = fingerprintPublicKeyPem(keypair.publicKeyPem);
    
    assert.strictEqual(fp1, fp2);
  });

  it("should return 16-character hex string", () => {
    const keypair = loadOrCreateClientKeypair();
    const fp = fingerprintPublicKeyPem(keypair.publicKeyPem);
    
    assert.strictEqual(fp.length, 16);
    assert.ok(/^[0-9a-f]+$/.test(fp));
  });
});

describe("sign and verify nonce", () => {
  it("should sign and verify a nonce successfully", () => {
    const keypair = loadOrCreateClientKeypair();
    const nonce = "test-nonce-12345";
    
    const signatureB64 = signNonce({
      privateKeyPem: keypair.privateKeyPem,
      nonce
    });
    
    assert.ok(signatureB64);
    assert.ok(signatureB64.length > 0);
    
    const valid = verifySignedNonce({
      publicKeyPem: keypair.publicKeyPem,
      nonce,
      signatureB64
    });
    
    assert.strictEqual(valid, true);
  });

  it("should fail verification with wrong nonce", () => {
    const keypair = loadOrCreateClientKeypair();
    
    const signatureB64 = signNonce({
      privateKeyPem: keypair.privateKeyPem,
      nonce: "original-nonce"
    });
    
    const valid = verifySignedNonce({
      publicKeyPem: keypair.publicKeyPem,
      nonce: "different-nonce",
      signatureB64
    });
    
    assert.strictEqual(valid, false);
  });

  it("should fail verification with wrong signature", async () => {
    const keypair = loadOrCreateClientKeypair();
    const nonce = "test-nonce";
    
    // Create a different keypair for wrong signature
    const crypto = await import("node:crypto");
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const wrongPrivateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
    
    const wrongSignature = signNonce({
      privateKeyPem: wrongPrivateKeyPem,
      nonce
    });
    
    const valid = verifySignedNonce({
      publicKeyPem: keypair.publicKeyPem,
      nonce,
      signatureB64: wrongSignature
    });
    
    assert.strictEqual(valid, false);
  });

  it("should handle empty nonce", () => {
    const keypair = loadOrCreateClientKeypair();
    
    const signatureB64 = signNonce({
      privateKeyPem: keypair.privateKeyPem,
      nonce: ""
    });
    
    const valid = verifySignedNonce({
      publicKeyPem: keypair.publicKeyPem,
      nonce: "",
      signatureB64
    });
    
    assert.strictEqual(valid, true);
  });

  it("should handle unicode nonce", () => {
    const keypair = loadOrCreateClientKeypair();
    const nonce = "测试-🔐-тест";
    
    const signatureB64 = signNonce({
      privateKeyPem: keypair.privateKeyPem,
      nonce
    });
    
    const valid = verifySignedNonce({
      publicKeyPem: keypair.publicKeyPem,
      nonce,
      signatureB64
    });
    
    assert.strictEqual(valid, true);
  });
});
