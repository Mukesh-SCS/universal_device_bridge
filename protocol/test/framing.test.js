/**
 * Protocol Framing Tests
 * 
 * Tests for the UDB wire protocol framing layer.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { encodeFrame, createFrameDecoder } from "../src/framing.js";

describe("encodeFrame", () => {
  it("should encode a simple object", () => {
    const frame = encodeFrame({ type: "hello", name: "test" });
    
    // Should be Buffer
    assert.ok(Buffer.isBuffer(frame));
    
    // First 4 bytes are length (big-endian)
    const length = frame.readUInt32BE(0);
    assert.strictEqual(length, frame.length - 4);
    
    // Rest is JSON payload
    const payload = JSON.parse(frame.slice(4).toString("utf8"));
    assert.strictEqual(payload.type, "hello");
    assert.strictEqual(payload.name, "test");
  });

  it("should handle Buffer values by converting to base64", () => {
    const testBuffer = Buffer.from("hello world");
    const frame = encodeFrame({ type: "test", data: testBuffer });
    
    const length = frame.readUInt32BE(0);
    const payload = JSON.parse(frame.slice(4).toString("utf8"));
    
    assert.strictEqual(payload.type, "test");
    assert.strictEqual(payload.data.__buffer, true);
    assert.strictEqual(payload.data.data, testBuffer.toString("base64"));
  });

  it("should handle empty objects", () => {
    const frame = encodeFrame({});
    const length = frame.readUInt32BE(0);
    assert.strictEqual(length, 2); // "{}"
  });

  it("should handle nested objects", () => {
    const nested = { 
      type: "complex", 
      data: { 
        nested: { 
          deep: "value" 
        } 
      } 
    };
    const frame = encodeFrame(nested);
    const payload = JSON.parse(frame.slice(4).toString("utf8"));
    
    assert.strictEqual(payload.data.nested.deep, "value");
  });
});

describe("createFrameDecoder", () => {
  it("should decode a single complete frame", async () => {
    const messages = [];
    const decoder = createFrameDecoder((msg) => messages.push(msg));
    
    const frame = encodeFrame({ type: "hello", value: 42 });
    decoder(frame);
    
    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].type, "hello");
    assert.strictEqual(messages[0].value, 42);
  });

  it("should handle fragmented frames", async () => {
    const messages = [];
    const decoder = createFrameDecoder((msg) => messages.push(msg));
    
    const frame = encodeFrame({ type: "test", data: "hello" });
    
    // Send in two parts
    decoder(frame.slice(0, 6));
    assert.strictEqual(messages.length, 0);
    
    decoder(frame.slice(6));
    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].type, "test");
  });

  it("should handle multiple frames in one chunk", async () => {
    const messages = [];
    const decoder = createFrameDecoder((msg) => messages.push(msg));
    
    const frame1 = encodeFrame({ type: "msg1" });
    const frame2 = encodeFrame({ type: "msg2" });
    const frame3 = encodeFrame({ type: "msg3" });
    
    decoder(Buffer.concat([frame1, frame2, frame3]));
    
    assert.strictEqual(messages.length, 3);
    assert.strictEqual(messages[0].type, "msg1");
    assert.strictEqual(messages[1].type, "msg2");
    assert.strictEqual(messages[2].type, "msg3");
  });

  it("should restore Buffer values from base64", async () => {
    const messages = [];
    const decoder = createFrameDecoder((msg) => messages.push(msg));
    
    const original = Buffer.from("test data");
    const frame = encodeFrame({ type: "binary", payload: original });
    decoder(frame);
    
    assert.strictEqual(messages.length, 1);
    assert.ok(Buffer.isBuffer(messages[0].payload));
    assert.strictEqual(messages[0].payload.toString(), "test data");
  });

  it("should emit error for oversized frames", async () => {
    const messages = [];
    const decoder = createFrameDecoder((msg) => messages.push(msg));
    
    // Create a fake header with huge length
    const fakeHeader = Buffer.alloc(4);
    fakeHeader.writeUInt32BE(100_000_000, 0); // 100MB - way over limit
    
    decoder(fakeHeader);
    
    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].type, "error");
    assert.strictEqual(messages[0].error, "frame_too_large");
  });

  it("should emit error for invalid JSON", async () => {
    const messages = [];
    const decoder = createFrameDecoder((msg) => messages.push(msg));
    
    // Create frame with invalid JSON
    const invalidJson = Buffer.from("not json at all");
    const header = Buffer.alloc(4);
    header.writeUInt32BE(invalidJson.length, 0);
    
    decoder(Buffer.concat([header, invalidJson]));
    
    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].type, "error");
    assert.strictEqual(messages[0].error, "invalid_json");
  });
});
