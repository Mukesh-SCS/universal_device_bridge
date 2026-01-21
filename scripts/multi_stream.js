#!/usr/bin/env node
/**
 * Multi-Stream Example Script
 * 
 * Demonstrates opening multiple concurrent streams to a device.
 * This pattern is what a GUI would use for:
 * - Shell terminal
 * - Log viewer
 * - Status monitor
 * - File transfer progress
 * 
 * All running simultaneously in one session.
 * 
 * Usage:
 *   node scripts/multi_stream.js [target]
 *   node scripts/multi_stream.js 10.0.0.1:9910
 */

import { 
  createSession, 
  resolveTarget,
  parseTarget 
} from "@udb/client";

const target = process.argv[2] 
  ? parseTarget(process.argv[2]) 
  : await resolveTarget();

console.log(`Connecting to ${target.host}:${target.port}...`);

// Create a single session for all streams
const session = await createSession(target);
console.log("✔ Connected and authenticated\n");

// Track active streams
const activeStreams = new Map();

/**
 * Open a service and set up event handlers
 */
function openServiceStream(name, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await session.openService(name, options);
      
      stream.on("data", (data) => {
        const content = data.toString();
        console.log(`[${name}] Data: ${content.slice(0, 100)}${content.length > 100 ? "..." : ""}`);
      });
      
      stream.on("close", () => {
        console.log(`[${name}] Stream closed`);
        activeStreams.delete(name);
      });
      
      stream.on("error", (err) => {
        console.error(`[${name}] Error: ${err.message}`);
        activeStreams.delete(name);
      });
      
      activeStreams.set(name, stream);
      resolve(stream);
    } catch (err) {
      reject(err);
    }
  });
}

// Example 1: Query services (quick request-response)
console.log("--- Opening services stream ---");
try {
  await openServiceStream("services");
  // Give it time to complete
  await new Promise(r => setTimeout(r, 200));
} catch (err) {
  console.error(`Failed to open services: ${err.message}`);
}

// Example 2: Query info (another quick request-response)
console.log("\n--- Opening info stream ---");
try {
  await openServiceStream("info");
  await new Promise(r => setTimeout(r, 200));
} catch (err) {
  console.error(`Failed to open info: ${err.message}`);
}

// Example 3: Open multiple streams concurrently
console.log("\n--- Opening concurrent streams ---");
try {
  // Open services and info at the same time
  const [services, info] = await Promise.all([
    openServiceStream("services"),
    openServiceStream("info")
  ]);
  
  console.log(`Opened ${activeStreams.size} streams concurrently`);
  await new Promise(r => setTimeout(r, 300));
} catch (err) {
  console.error(`Concurrent stream error: ${err.message}`);
}

// Example 4: Interactive pattern - keep shell open while querying status
console.log("\n--- Simulating GUI pattern ---");
console.log("In a real GUI, you might have:");
console.log("  - Shell terminal (persistent)");
console.log("  - Log viewer (persistent)");
console.log("  - Status bar (periodic queries)");
console.log("  - File browser (on-demand)");

// Demonstrate the session is still active
console.log("\n--- Session operations ---");
const result = await session.exec("whoami");
console.log(`Executed 'whoami': ${result.stdout.trim()}`);

const status = await session.status();
console.log(`Device name: ${status.name}`);

// Summary
console.log("\n--- Summary ---");
console.log(`Active streams: ${activeStreams.size}`);
console.log(`Session authenticated: ${session.authenticated}`);
console.log(`Session has socket: ${Boolean(session.socket)}`);

// Clean up
console.log("\n--- Cleanup ---");
for (const [name, stream] of activeStreams) {
  console.log(`Closing stream: ${name}`);
  stream.close();
}

await session.close();
console.log("Session closed");
console.log("\n✔ Multi-stream example complete");
