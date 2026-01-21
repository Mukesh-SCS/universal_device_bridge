/**
 * Protocol Messages Tests
 * 
 * Tests for UDB message types and constructors.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { MSG, hello } from "../src/messages.js";

describe("MSG constants", () => {
  it("should have all required message types", () => {
    // Connection & Auth
    assert.strictEqual(MSG.HELLO, "hello");
    assert.strictEqual(MSG.HELLO_OK, "hello_ok");
    assert.strictEqual(MSG.AUTH_REQUIRED, "auth_required");
    assert.strictEqual(MSG.AUTH_CHALLENGE, "auth_challenge");
    assert.strictEqual(MSG.AUTH_RESPONSE, "auth_response");
    assert.strictEqual(MSG.AUTH_OK, "auth_ok");
    assert.strictEqual(MSG.AUTH_FAIL, "auth_fail");

    // Pairing
    assert.strictEqual(MSG.PAIR_REQUEST, "pair_request");
    assert.strictEqual(MSG.PAIR_OK, "pair_ok");
    assert.strictEqual(MSG.PAIR_DENIED, "pair_denied");
    assert.strictEqual(MSG.UNPAIR_REQUEST, "unpair_request");
    assert.strictEqual(MSG.UNPAIR_OK, "unpair_ok");
    assert.strictEqual(MSG.UNPAIR_ALL, "unpair_all");

    // Execution
    assert.strictEqual(MSG.EXEC, "exec");
    assert.strictEqual(MSG.EXEC_RESULT, "exec_result");

    // Status
    assert.strictEqual(MSG.STATUS, "status");
    assert.strictEqual(MSG.STATUS_RESULT, "status_result");
    assert.strictEqual(MSG.LIST_PAIRED, "list_paired");
    assert.strictEqual(MSG.LIST_PAIRED_RESULT, "list_paired_result");

    // File Transfer
    assert.strictEqual(MSG.PUSH_BEGIN, "push_begin");
    assert.strictEqual(MSG.PUSH_CHUNK, "push_chunk");
    assert.strictEqual(MSG.PUSH_END, "push_end");
    assert.strictEqual(MSG.PULL_BEGIN, "pull_begin");
    assert.strictEqual(MSG.PULL_CHUNK, "pull_chunk");
    assert.strictEqual(MSG.PULL_END, "pull_end");

    // Streaming Services
    assert.strictEqual(MSG.OPEN_SERVICE, "open_service");
    assert.strictEqual(MSG.STREAM_DATA, "stream_data");
    assert.strictEqual(MSG.STREAM_CLOSE, "stream_close");
    assert.strictEqual(MSG.STREAM_RESIZE, "stream_resize");
    assert.strictEqual(MSG.SERVICE_ERROR, "service_error");

    // Error
    assert.strictEqual(MSG.ERROR, "error");
  });
});

describe("hello message constructor", () => {
  it("should create a valid hello message", () => {
    const msg = hello({
      clientName: "test-client",
      pubKey: "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----"
    });

    assert.strictEqual(msg.type, "hello");
    assert.strictEqual(msg.clientName, "test-client");
    assert.ok(msg.pubKey.includes("BEGIN PUBLIC KEY"));
  });

  it("should handle missing optional fields", () => {
    const msg = hello({ clientName: "minimal" });
    
    assert.strictEqual(msg.type, "hello");
    assert.strictEqual(msg.clientName, "minimal");
    assert.strictEqual(msg.pubKey, undefined);
  });
});
