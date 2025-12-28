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
  ERROR: "error"
};

export function hello({ clientName, pubKey }) {
  return { type: MSG.HELLO, clientName, pubKey };
}
