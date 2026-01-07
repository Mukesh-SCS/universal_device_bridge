#!/usr/bin/env node

/**
 * Example 1: Simple device discovery and status
 * 
 * Shows how to discover devices and check their status programmatically.
 */

import { discoverDevices, status } from "@udb/client";

async function main() {
  console.log("🔍 Discovering devices...\n");

  const devices = await discoverDevices();

  if (devices.length === 0) {
    console.log("No devices found on the network.");
    return;
  }

  console.log(`Found ${devices.length} device(s):\n`);

  for (const device of devices) {
    const target = `${device.host}:${device.port}`;
    console.log(`  Device: ${device.name} (${target})`);

    try {
      const info = await status(device);
      console.log(`    ✓ Status: ${info.pairingMode}`);
      console.log(`    ✓ Paired clients: ${info.pairedCount}`);
    } catch (err) {
      console.log(`    ✗ Error: ${err.message}`);
    }

    console.log();
  }
}

main().catch(console.error);
