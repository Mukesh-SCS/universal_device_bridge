#!/usr/bin/env node

/**
 * Example 5: Error handling patterns
 * 
 * Shows how to handle various error types gracefully.
 */

import {
  resolveTarget,
  pair,
  exec,
  AuthError,
  ConnectionError,
  CommandError,
  UdbError
} from "@udb/client";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`Usage: ${process.argv[1]} <target>`);
    console.log(`\nExample: ${process.argv[1]} 10.0.0.1:9910`);
    process.exit(1);
  }

  const target = await resolveTarget(args[0]);
  console.log(`🔐 Error Handling Example\n`);

  // Example 1: Auth error (device not paired)
  console.log("1️⃣  Attempting to exec on unpaired device...");
  try {
    const result = await exec(target, "whoami");
    console.log(`Output: ${result.stdout}`);
  } catch (err) {
    if (err instanceof AuthError) {
      console.log(`✗ Auth failed (expected): ${err.message}`);
      console.log(`   Action: Run 'udb pair ${target.host}:${target.port}'\n`);
    } else {
      throw err;
    }
  }

  // Example 2: Pair with device
  console.log("2️⃣  Attempting to pair...");
  try {
    const result = await pair(target);
    console.log(`✓ Paired successfully: ${result.fingerprint}\n`);
  } catch (err) {
    if (err instanceof AuthError) {
      console.log(`✗ Pairing denied: ${err.message}\n`);
    } else if (err instanceof ConnectionError) {
      console.log(`✗ Connection failed: ${err.message}`);
      console.log(`   Action: Check device is online and listening\n`);
    } else {
      throw err;
    }
  }

  // Example 3: Command that fails
  console.log("3️⃣  Running command that will fail...");
  try {
    const result = await exec(target, "false"); // Exit code 1
  } catch (err) {
    if (err instanceof CommandError) {
      console.log(`✗ Command failed with exit code: ${err.code}`);
      console.log(`   Message: ${err.message}\n`);
    } else {
      throw err;
    }
  }

  // Example 4: Generic error handler
  console.log("4️⃣  Generic error handling...");
  try {
    // This could fail for various reasons
    const result = await exec(target, "echo test");
    console.log(`✓ Success: ${result.stdout.trim()}`);
  } catch (err) {
    if (err instanceof UdbError) {
      console.log(`✗ UDB Error [${err.code}]: ${err.message}`);
    } else {
      console.log(`✗ Unexpected error: ${err.message}`);
    }
  }

  console.log("\n✓ Error handling examples completed");
}

main().catch(console.error);
