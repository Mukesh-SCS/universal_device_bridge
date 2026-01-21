/**
 * Multi-Stream Concurrency Tests
 * 
 * Validates that multiple streams can run concurrently within a session:
 * - Independent stream routing
 * - Early stream close doesn't affect others
 * - Session lifecycle with multiple open streams
 * 
 * This proves GUI-readiness without building a GUI.
 */

import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert";
import net from "node:net";
import crypto from "node:crypto";

import { encodeFrame, createFrameDecoder } from "@udb/protocol/src/framing.js";
import { MSG } from "@udb/protocol/src/messages.js";
import {
  loadOrCreateClientKeypair,
  verifySignedNonce
} from "@udb/protocol/src/crypto.js";

/**
 * Create a mock daemon that handles multiple concurrent streams
 */
function createMockDaemon(port) {
  let server;
  const connections = [];
  const streamData = new Map(); // streamId -> accumulated data
  
  return {
    async start() {
      return new Promise((resolve) => {
        server = net.createServer((socket) => {
          connections.push(socket);
          
          let clientPubKey = null;
          let authed = false;
          
          const decoder = createFrameDecoder(async (m) => {
            // HELLO
            if (m.type === MSG.HELLO) {
              clientPubKey = m.pubKey;
              
              // Send auth challenge
              const nonce = crypto.randomBytes(24).toString("base64");
              socket.write(encodeFrame({
                type: MSG.AUTH_CHALLENGE,
                nonce,
                expiresInMs: 30000
              }));
              
              // Store nonce for verification
              socket._pendingNonce = nonce;
              return;
            }
            
            // AUTH_RESPONSE
            if (m.type === MSG.AUTH_RESPONSE) {
              const ok = verifySignedNonce({
                publicKeyPem: clientPubKey,
                nonce: socket._pendingNonce,
                signatureB64: m.signatureB64
              });
              
              if (ok) {
                authed = true;
                socket.write(encodeFrame({ type: MSG.AUTH_OK, deviceName: "mock-daemon" }));
              } else {
                socket.write(encodeFrame({ type: MSG.AUTH_FAIL, reason: "bad_signature" }));
              }
              return;
            }
            
            // OPEN_SERVICE - handle multiple concurrent services
            if (m.type === MSG.OPEN_SERVICE) {
              const streamId = m.streamId;
              const service = m.service;
              
              // Store stream data
              streamData.set(streamId, { service, data: [] });
              
              // Simulate different services
              if (service === "echo") {
                // Echo service - echoes back data with prefix
                socket._streams = socket._streams || new Map();
                socket._streams.set(streamId, { type: "echo" });
              } else if (service === "counter") {
                // Counter service - sends incrementing numbers
                socket._streams = socket._streams || new Map();
                socket._streams.set(streamId, { type: "counter", count: 0 });
                
                // Start sending numbers
                const interval = setInterval(() => {
                  const stream = socket._streams?.get(streamId);
                  if (!stream || socket.destroyed) {
                    clearInterval(interval);
                    return;
                  }
                  
                  stream.count++;
                  socket.write(encodeFrame({
                    type: MSG.STREAM_DATA,
                    streamId,
                    b64: Buffer.from(`count:${stream.count}`).toString("base64")
                  }));
                  
                  // Stop after 10 counts
                  if (stream.count >= 10) {
                    clearInterval(interval);
                    socket.write(encodeFrame({ type: MSG.STREAM_CLOSE, streamId }));
                    socket._streams.delete(streamId);
                  }
                }, 50);
              } else if (service === "info") {
                // Info service - sends once and closes
                socket.write(encodeFrame({
                  type: MSG.STREAM_DATA,
                  streamId,
                  b64: Buffer.from(JSON.stringify({ type: "info", service })).toString("base64")
                }));
                socket.write(encodeFrame({ type: MSG.STREAM_CLOSE, streamId }));
              } else if (service === "slow") {
                // Slow service - waits then sends
                setTimeout(() => {
                  if (!socket.destroyed) {
                    socket.write(encodeFrame({
                      type: MSG.STREAM_DATA,
                      streamId,
                      b64: Buffer.from("slow-response").toString("base64")
                    }));
                    socket.write(encodeFrame({ type: MSG.STREAM_CLOSE, streamId }));
                  }
                }, 200);
              } else {
                // Unknown service
                socket.write(encodeFrame({
                  type: MSG.SERVICE_ERROR,
                  streamId,
                  error: "unknown_service"
                }));
              }
              return;
            }
            
            // STREAM_DATA - handle data for streams
            if (m.type === MSG.STREAM_DATA && m.streamId) {
              const data = Buffer.from(m.b64 || "", "base64").toString();
              const stream = socket._streams?.get(m.streamId);
              
              if (stream?.type === "echo") {
                // Echo back with prefix
                socket.write(encodeFrame({
                  type: MSG.STREAM_DATA,
                  streamId: m.streamId,
                  b64: Buffer.from(`echo:${data}`).toString("base64")
                }));
              }
              return;
            }
            
            // STREAM_CLOSE - handle close from client
            if (m.type === MSG.STREAM_CLOSE && m.streamId) {
              socket._streams?.delete(m.streamId);
              return;
            }
            
            // STATUS
            if (m.type === MSG.STATUS) {
              socket.write(encodeFrame({
                type: MSG.STATUS_RESULT,
                deviceName: "mock-daemon",
                version: "test"
              }));
              return;
            }
          });
          
          socket.on("data", decoder);
          socket.on("close", () => {
            const idx = connections.indexOf(socket);
            if (idx >= 0) connections.splice(idx, 1);
          });
        });
        
        server.listen(port, "127.0.0.1", resolve);
      });
    },
    
    async stop() {
      for (const sock of connections) {
        sock.destroy();
      }
      return new Promise((resolve) => {
        if (server) {
          server.close(resolve);
        } else {
          resolve();
        }
      });
    },
    
    getStreamData() {
      return streamData;
    }
  };
}

describe("Multi-stream concurrency", () => {
  const TEST_PORT = 9920;
  let daemon;
  
  before(async () => {
    daemon = createMockDaemon(TEST_PORT);
    await daemon.start();
  });
  
  after(async () => {
    await daemon.stop();
  });
  
  it("should route messages to correct streams independently", async () => {
    // Import dynamically to get fresh module
    const { createSession } = await import("../src/index.js");
    
    const session = await createSession({ host: "127.0.0.1", port: TEST_PORT });
    
    // Open two echo streams
    const stream1 = await session.openService("echo");
    const stream2 = await session.openService("echo");
    
    const received1 = [];
    const received2 = [];
    
    stream1.on("data", (data) => received1.push(data.toString()));
    stream2.on("data", (data) => received2.push(data.toString()));
    
    // Send to stream1
    stream1.write("hello1");
    
    // Wait for echo
    await new Promise(r => setTimeout(r, 100));
    
    // Send to stream2
    stream2.write("hello2");
    
    // Wait for echo
    await new Promise(r => setTimeout(r, 100));
    
    // Verify routing
    assert.ok(received1.some(d => d.includes("hello1")), "Stream1 should receive its echo");
    assert.ok(received2.some(d => d.includes("hello2")), "Stream2 should receive its echo");
    
    // Verify no cross-routing
    assert.ok(!received1.some(d => d.includes("hello2")), "Stream1 should not receive stream2 data");
    assert.ok(!received2.some(d => d.includes("hello1")), "Stream2 should not receive stream1 data");
    
    stream1.close();
    stream2.close();
    await session.close();
  });
  
  it("should handle one stream closing while others remain open", async () => {
    const { createSession } = await import("../src/index.js");
    
    const session = await createSession({ host: "127.0.0.1", port: TEST_PORT });
    
    // Open three streams
    const echo1 = await session.openService("echo");
    const echo2 = await session.openService("echo");
    const info = await session.openService("info");
    
    const received1 = [];
    const received2 = [];
    let infoClosed = false;
    
    echo1.on("data", (data) => received1.push(data.toString()));
    echo2.on("data", (data) => received2.push(data.toString()));
    info.on("close", () => { infoClosed = true; });
    
    // Wait for info to close automatically
    await new Promise(r => setTimeout(r, 100));
    assert.ok(infoClosed, "Info stream should auto-close");
    
    // Verify echo streams still work
    echo1.write("test1");
    echo2.write("test2");
    
    await new Promise(r => setTimeout(r, 100));
    
    assert.ok(received1.some(d => d.includes("test1")), "Echo1 still works after info closed");
    assert.ok(received2.some(d => d.includes("test2")), "Echo2 still works after info closed");
    
    echo1.close();
    echo2.close();
    await session.close();
  });
  
  it("should handle counter stream completing naturally", async () => {
    const { createSession } = await import("../src/index.js");
    
    const session = await createSession({ host: "127.0.0.1", port: TEST_PORT });
    
    const counter = await session.openService("counter");
    const received = [];
    let closed = false;
    
    counter.on("data", (data) => received.push(data.toString()));
    counter.on("close", () => { closed = true; });
    
    // Wait for counter to complete (10 messages at 50ms each = ~500ms)
    await new Promise(r => setTimeout(r, 700));
    
    assert.ok(closed, "Counter stream should close after completion");
    assert.strictEqual(received.length, 10, "Should receive 10 counter messages");
    assert.ok(received[0].includes("count:1"), "First count should be 1");
    assert.ok(received[9].includes("count:10"), "Last count should be 10");
    
    await session.close();
  });
  
  it("should handle mixed concurrent streams", async () => {
    const { createSession } = await import("../src/index.js");
    
    const session = await createSession({ host: "127.0.0.1", port: TEST_PORT });
    
    // Open different types of streams
    const echo = await session.openService("echo");
    const counter = await session.openService("counter");
    const slow = await session.openService("slow");
    
    const echoData = [];
    const counterData = [];
    const slowData = [];
    
    echo.on("data", (data) => echoData.push(data.toString()));
    counter.on("data", (data) => counterData.push(data.toString()));
    slow.on("data", (data) => slowData.push(data.toString()));
    
    // Send to echo while counter is running
    echo.write("concurrent-test");
    
    // Wait for all to complete
    await new Promise(r => setTimeout(r, 800));
    
    // All streams should have received their appropriate data
    assert.ok(echoData.some(d => d.includes("concurrent-test")), "Echo received data");
    assert.ok(counterData.length > 0, "Counter received data");
    assert.ok(slowData.some(d => d.includes("slow-response")), "Slow received data");
    
    echo.close();
    await session.close();
  });
  
  it("should handle stream errors without affecting other streams", async () => {
    const { createSession } = await import("../src/index.js");
    
    const session = await createSession({ host: "127.0.0.1", port: TEST_PORT });
    
    // Open one good stream and one that will error
    const echo = await session.openService("echo");
    const unknown = await session.openService("unknown-service");
    
    const echoData = [];
    let unknownError = null;
    
    echo.on("data", (data) => echoData.push(data.toString()));
    unknown.on("error", (err) => { unknownError = err; });
    
    // Wait for error
    await new Promise(r => setTimeout(r, 100));
    
    // Unknown should have errored
    assert.ok(unknownError, "Unknown service should error");
    
    // Echo should still work
    echo.write("still-works");
    await new Promise(r => setTimeout(r, 100));
    
    assert.ok(echoData.some(d => d.includes("still-works")), "Echo still works after other stream errored");
    
    echo.close();
    await session.close();
  });
});

describe("Session with streams lifecycle", () => {
  const TEST_PORT = 9921;
  let daemon;
  
  before(async () => {
    daemon = createMockDaemon(TEST_PORT);
    await daemon.start();
  });
  
  after(async () => {
    await daemon.stop();
  });
  
  it("should track open streams count", async () => {
    const { createSession, UdbSession } = await import("../src/index.js");
    
    const session = await createSession({ host: "127.0.0.1", port: TEST_PORT });
    
    assert.strictEqual(session.openStreams.size, 0, "Should start with no streams");
    
    const stream1 = await session.openService("echo");
    assert.strictEqual(session.openStreams.size, 1, "Should have 1 stream");
    
    const stream2 = await session.openService("echo");
    assert.strictEqual(session.openStreams.size, 2, "Should have 2 streams");
    
    stream1.close();
    await new Promise(r => setTimeout(r, 50));
    
    // Note: closed streams stay in map until daemon confirms close
    // In a real scenario, the daemon would send STREAM_CLOSE back
    
    await session.close();
  });
  
  it("should assign unique stream IDs", async () => {
    const { createSession } = await import("../src/index.js");
    
    const session = await createSession({ host: "127.0.0.1", port: TEST_PORT });
    
    const stream1 = await session.openService("echo");
    const stream2 = await session.openService("echo");
    const stream3 = await session.openService("echo");
    
    const ids = [stream1.streamId, stream2.streamId, stream3.streamId];
    const uniqueIds = new Set(ids);
    
    assert.strictEqual(uniqueIds.size, 3, "All stream IDs should be unique");
    
    stream1.close();
    stream2.close();
    stream3.close();
    await session.close();
  });
});
