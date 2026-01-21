import { Buffer } from "node:buffer";

const MAX_FRAME_BYTES = 8 * 1024 * 1024; // 8MB hard cap to prevent memory DoS

/**
 * Recursively process an object and convert all Buffer instances to 
 * { __buffer: true, data: base64 } format before JSON.stringify runs.
 * This is needed because JSON.stringify calls toJSON() on objects before
 * passing them to the replacer, so Buffers become { type: 'Buffer', data: [...] }.
 */
function serializeBuffers(obj) {
  if (Buffer.isBuffer(obj)) {
    return { __buffer: true, data: obj.toString("base64") };
  }
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => serializeBuffers(item));
  }
  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = serializeBuffers(obj[key]);
  }
  return result;
}

export function encodeFrame(obj) {
  // Convert Buffer objects to base64 for JSON serialization (pre-process)
  const serializable = serializeBuffers(obj);
  const payload = Buffer.from(JSON.stringify(serializable), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32BE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

export function createFrameDecoder(onMessage) {
  let buf = Buffer.alloc(0);

  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);

    while (buf.length >= 4) {
      const len = buf.readUInt32BE(0);

      // Guard against bogus lengths / DoS
      if (len <= 0 || len > MAX_FRAME_BYTES) {
        onMessage({ type: "error", error: "frame_too_large", max: MAX_FRAME_BYTES, got: len });
        // Drop buffer to recover; caller may choose to close socket
        buf = Buffer.alloc(0);
        return;
      }

      if (buf.length < 4 + len) return;

      const payload = buf.slice(4, 4 + len).toString("utf8");
      buf = buf.slice(4 + len);

      let msg;
      try {
        // Convert base64 strings back to Buffers
        const reviver = (key, value) => {
          if (value && typeof value === "object" && value.__buffer === true) {
            return Buffer.from(value.data, "base64");
          }
          return value;
        };
        msg = JSON.parse(payload, reviver);
      } catch {
        onMessage({ type: "error", error: "invalid_json" });
        continue;
      }

      onMessage(msg);
    }
  };
}
