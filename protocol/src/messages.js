/**
 * UDB Protocol Version
 * 
 * Version history:
 * - 1: Initial protocol (Phase 1-3)
 * - Future versions will be documented here
 */
export const PROTOCOL_VERSION = 1;

export const MSG = {
  HELLO: "hello",
  HELLO_OK: "hello_ok",
  PAIR_REQUEST: "pair_request",
  PAIR_OK: "pair_ok",
  PAIR_DENIED: "pair_denied",
  UNPAIR_REQUEST: "unpair_request",
  UNPAIR_OK: "unpair_ok",
  UNPAIR_ALL: "unpair_all",
  AUTH_REQUIRED: "auth_required",
  AUTH_CHALLENGE: "auth_challenge",
  AUTH_RESPONSE: "auth_response",
  AUTH_OK: "auth_ok",
  AUTH_FAIL: "auth_fail",
  EXEC: "exec",
  EXEC_RESULT: "exec_result",
  LOGS: "logs",
  LOGS_CHUNK: "logs_chunk",
  PUSH_BEGIN: "push_begin",
  PUSH_CHUNK: "push_chunk",
  PUSH_END: "push_end",
  PULL_BEGIN: "pull_begin",
  PULL_CHUNK: "pull_chunk",
  PULL_END: "pull_end",
  ERROR: "error",
  STATUS: "status",
  STATUS_RESULT: "status_result",
  LIST_PAIRED: "list_paired",
  LIST_PAIRED_RESULT: "list_paired_result",
  FILE_PUSH_START: "file_push_start",
  FILE_PUSH_CHUNK: "file_push_chunk",
  FILE_PUSH_END: "file_push_end",
  FILE_PULL_START: "file_pull_start",
  FILE_PULL_CHUNK: "file_pull_chunk",
  FILE_PULL_END: "file_pull_end",
  FILE_ERROR: "file_error",
  // Streaming services
  OPEN_SERVICE: "open_service",
  STREAM_DATA: "stream_data",
  STREAM_CLOSE: "stream_close",
  STREAM_RESIZE: "stream_resize",
  SERVICE_ERROR: "service_error"
};

export function hello({ clientName, pubKey, protocol = PROTOCOL_VERSION }) {
  return { type: MSG.HELLO, clientName, pubKey, protocol };
}
