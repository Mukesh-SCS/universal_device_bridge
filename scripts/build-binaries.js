#!/usr/bin/env node

/**
 * UDB Binary Build Script
 * 
 * Builds standalone executables for all platforms using pkg.
 * 
 * Usage:
 *   node scripts/build-binaries.js [options]
 * 
 * Options:
 *   --all           Build for all platforms
 *   --linux         Build for Linux (x64 + arm64)
 *   --macos         Build for macOS (Intel + Apple Silicon)
 *   --windows       Build for Windows (x64)
 *   --current       Build for current platform only
 *   --output <dir>  Output directory (default: dist)
 */

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TARGETS = {
  "linux-x64": "node18-linux-x64",
  "linux-arm64": "node18-linux-arm64",
  "macos-x64": "node18-macos-x64",
  "macos-arm64": "node18-macos-arm64",
  "win-x64": "node18-win-x64"
};

const OUTPUT_NAMES = {
  "linux-x64": "udb-linux-x64",
  "linux-arm64": "udb-linux-arm64",
  "macos-x64": "udb-macos-x64",
  "macos-arm64": "udb-macos-arm64",
  "win-x64": "udb-win-x64.exe"
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    platforms: [],
    output: path.join(ROOT, "dist")
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--all":
        options.platforms = Object.keys(TARGETS);
        break;
      case "--linux":
        options.platforms.push("linux-x64", "linux-arm64");
        break;
      case "--macos":
        options.platforms.push("macos-x64", "macos-arm64");
        break;
      case "--windows":
        options.platforms.push("win-x64");
        break;
      case "--current":
        options.platforms.push(getCurrentPlatform());
        break;
      case "--output":
        options.output = path.resolve(args[++i]);
        break;
    }
  }

  // Default to current platform
  if (options.platforms.length === 0) {
    options.platforms.push(getCurrentPlatform());
  }

  return options;
}

function getCurrentPlatform() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "linux") {
    return arch === "arm64" ? "linux-arm64" : "linux-x64";
  }
  if (platform === "darwin") {
    return arch === "arm64" ? "macos-arm64" : "macos-x64";
  }
  if (platform === "win32") {
    return "win-x64";
  }

  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function computeChecksum(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function buildForTarget(platform, outputDir) {
  const target = TARGETS[platform];
  const outputName = OUTPUT_NAMES[platform];
  const outputPath = path.join(outputDir, outputName);

  console.log(`\n📦 Building for ${platform}...`);
  console.log(`   Target: ${target}`);
  console.log(`   Output: ${outputPath}`);

  
  const entryPoint = path.join(ROOT, "cli", "udb.cjs");

  const result = spawnSync(
    `npx pkg ${entryPoint} --target ${target} --output ${outputPath} --compress GZip --options experimental-modules`,
    [],
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: true
    }
  );

  if (result.status !== 0) {
    throw new Error(`Build failed for ${platform}`);
  }

  // Checksum
  if (fs.existsSync(outputPath)) {
    const checksum = computeChecksum(outputPath);
    fs.writeFileSync(`${outputPath}.sha256`, `${checksum}  ${outputName}\n`);
    console.log(`   ✓ Checksum: ${checksum.slice(0, 16)}...`);
    console.log(
      `   ✓ Size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)} MB`
    );
  }

  return outputPath;
}


async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║     UDB Binary Build                   ║");
  console.log("╚════════════════════════════════════════╝");

  const options = parseArgs();

  console.log(`\nPlatforms: ${options.platforms.join(", ")}`);
  console.log(`Output: ${options.output}`);

  // Ensure output directory exists
  ensureDir(options.output);

  // Build for each platform
  const built = [];
  for (const platform of options.platforms) {
    try {
      const outputPath = buildForTarget(platform, options.output);
      built.push({ platform, path: outputPath, success: true });
    } catch (err) {
      console.error(`   ✗ Failed: ${err.message}`);
      built.push({ platform, error: err.message, success: false });
    }
  }

  // Summary
  console.log("\n────────────────────────────────────────");
  console.log("Build Summary:");
  for (const b of built) {
    const status = b.success ? "✓" : "✗";
    console.log(`  ${status} ${b.platform}`);
  }

  const successCount = built.filter(b => b.success).length;
  const failCount = built.filter(b => !b.success).length;

  console.log(`\nBuilt: ${successCount}/${built.length}`);

  if (failCount > 0) {
    process.exit(1);
  }

  // Create combined checksum file
  const checksumPath = path.join(options.output, "SHA256SUMS");
  let checksumContent = "";
  for (const b of built) {
    if (b.success) {
      const name = OUTPUT_NAMES[b.platform];
      const checksum = computeChecksum(b.path);
      checksumContent += `${checksum}  ${name}\n`;
    }
  }
  fs.writeFileSync(checksumPath, checksumContent);
  console.log(`\nChecksums written to: ${checksumPath}`);

  console.log("\n✅ Build complete!");
}

main().catch(err => {
  console.error(`\n❌ Build failed: ${err.message}`);
  process.exit(1);
});
