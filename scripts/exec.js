#!/usr/bin/env node

/**
 * Example 2: Batch execution across multiple devices
 * 
 * Demonstrates running a command on multiple devices in parallel.
 */

import { discoverDevices, execBatch } from "@udb/client";

async function main() {
  console.log("🚀 Running command on all discovered devices...\n");

  const devices = await discoverDevices();

  if (devices.length === 0) {
    console.log("No devices found.");
    return;
  }

  console.log(`Found ${devices.length} device(s). Running 'uname -a'...\n`);

  try {
    const results = await execBatch(devices, "uname -a", { parallel: true });

    for (const res of results) {
      const target = `${res.target.host}:${res.target.port}`;

      if (res.success) {
        console.log(`✓ ${target}:`);
        console.log(`  ${res.result.stdout.trim()}`);
      } else {
        console.log(`✗ ${target}:`);
        console.log(`  Error: ${res.error.message}`);
      }

      console.log();
    }

    // Summary
    const successes = results.filter((r) => r.success).length;
    console.log(`Summary: ${successes}/${results.length} successful`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }
}

main().catch(console.error);
