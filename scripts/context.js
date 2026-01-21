#!/usr/bin/env node

/**
 * Example 3: Using persistent sessions
 * 
 * Shows how to maintain a connection and reuse it for multiple operations.
 */

import { createSession, resolveTarget } from "@udb/client";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`Usage: ${process.argv[1]} <target>`);
    console.log(`\nExample: ${process.argv[1]} 192.168.1.100:9910`);
    process.exit(1);
  }

  const target = await resolveTarget(args[0]);
  console.log(`📡 Creating session with ${target.host}:${target.port}...\n`);

  const session = await createSession(target);

  try {
    // Multiple operations in one session (more efficient)
    console.log("Running multiple commands in session...\n");

    const info = await session.status();
    console.log(`Device: ${info.name}`);
    console.log(`Pairing mode: ${info.pairingMode}\n`);

    const result1 = await session.exec("whoami");
    console.log(`whoami output: ${result1.stdout.trim()}\n`);

    const result2 = await session.exec("pwd");
    console.log(`pwd output: ${result2.stdout.trim()}\n`);

    const result3 = await session.exec("date");
    console.log(`date output: ${result3.stdout.trim()}\n`);

    console.log("✓ All commands executed successfully");
  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    await session.close();
    console.log("\n📴 Session closed");
  }
}

main().catch(console.error);
