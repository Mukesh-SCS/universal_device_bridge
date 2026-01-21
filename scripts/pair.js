#!/usr/bin/env node

/**
 * Example 4: Context management
 * 
 * Demonstrates creating and using contexts for easy device management.
 */

import { 
  discoverDevices, 
  addContext, 
  getContexts, 
  getCurrentContextName,
  setCurrentContext,
  resolveTarget,
  status
} from "@udb/client";

async function main() {
  console.log("📋 Context Management Example\n");

  // Discover devices
  console.log("1️⃣  Discovering devices...");
  const devices = await discoverDevices();

  if (devices.length === 0) {
    console.log("No devices found.");
    return;
  }

  // Add contexts for discovered devices
  console.log(`Found ${devices.length} device(s)\n`);

  for (let i = 0; i < devices.length && i < 3; i++) {
    const d = devices[i];
    const ctxName = `device-${i + 1}`;

    addContext(ctxName, {
      host: d.host,
      port: d.port,
      name: d.name
    });

    console.log(`✓ Added context: "${ctxName}" → ${d.host}:${d.port}`);
  }

  // Show all contexts
  console.log("\n2️⃣  Listing contexts:");
  const contexts = getContexts();

  for (const [name, ctx] of Object.entries(contexts)) {
    console.log(`  ${name}: ${ctx.host}:${ctx.port} (${ctx.name})`);
  }

  // Use a context
  if (Object.keys(contexts).length > 0) {
    console.log("\n3️⃣  Using a context:");
    const contextName = Object.keys(contexts)[0];

    setCurrentContext(contextName);
    console.log(`✓ Set current context to: "${contextName}"`);

    const current = getCurrentContextName();
    console.log(`✓ Current context: "${current}"`);

    // Resolve without explicit target (uses current context)
    console.log("\n4️⃣  Resolving target from context...");
    const target = await resolveTarget(); // No args = uses current context
    console.log(`✓ Resolved target: ${target.host}:${target.port}`);

    const info = await status(target);
    console.log(`✓ Device status: ${info.name} (${info.pairingMode})`);
  }
}

main().catch(console.error);
