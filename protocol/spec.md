# UDB Protocol Specification

This document describes the wire protocol for Universal Device Bridge.

---

## Overview

UDB uses a simple length-prefixed JSON protocol over TCP. All messages are JSON objects with a `type` field indicating the message type.

---

## Frame Format

```
┌─────────────────────────────────────────────┐
│  4 bytes (BE)  │  N bytes                   │
│  Payload Len   │  JSON Payload (UTF-8)      │
└─────────────────────────────────────────────┘
```

- **Length**: 4-byte big-endian unsigned integer
- **Payload**: UTF-8 encoded JSON object

---

## Message Types

### Connection & Authentication

| Type | Direction | Description |
|------|-----------|-------------|
| `hello` | Client → Device | Initial connection with client name and public key |
| `hello_ok` | Device → Client | Connection accepted |
| `auth_required` | Device → Client | Client not paired, pairing required |
| `auth_challenge` | Device → Client | Authentication challenge with nonce |
| `auth_response` | Client → Device | Signed nonce response |
| `auth_ok` | Device → Client | Authentication successful |
| `auth_fail` | Device → Client | Authentication failed |

### Pairing

| Type | Direction | Description |
|------|-----------|-------------|
| `pair_request` | Client → Device | Request to pair |
| `pair_ok` | Device → Client | Pairing successful with fingerprint |
| `pair_denied` | Device → Client | Pairing denied |
| `unpair_request` | Client → Device | Request to unpair |
| `unpair_ok` | Device → Client | Unpair successful |
| `unpair_all` | Client → Device | Remove all paired clients |

### Command Execution

| Type | Direction | Description |
|------|-----------|-------------|
| `exec` | Client → Device | Execute command |
| `exec_result` | Device → Client | Command result with stdout/stderr/code |

### File Transfer

| Type | Direction | Description |
|------|-----------|-------------|
| `push_begin` | Client → Device | Start file push, includes remotePath |
| `push_chunk` | Client → Device | File chunk (base64 encoded) |
| `push_end` | Client → Device | End file push |
| `push_ready` | Device → Client | Ready to receive chunks |
| `push_ack` | Device → Client | Chunk received acknowledgment |
| `push_ok` | Device → Client | Push completed successfully |
| `pull_begin` | Client → Device | Request file pull, includes remotePath |
| `pull_chunk` | Device → Client | File chunk (base64 encoded) |
| `pull_end` | Device → Client | End of file |

### Status & Discovery

| Type | Direction | Description |
|------|-----------|-------------|
| `status` | Client → Device | Request device status |
| `status_result` | Device → Client | Device status info |
| `list_paired` | Client → Device | List paired clients |
| `list_paired_result` | Device → Client | Paired clients list |

### Errors

| Type | Direction | Description |
|------|-----------|-------------|
| `error` | Device → Client | Error response with error code |

---

## Message Details

### hello

```json
{
  "type": "hello",
  "clientName": "my-client",
  "pubKey": "-----BEGIN PUBLIC KEY-----\n..."
}
```

### auth_challenge

```json
{
  "type": "auth_challenge",
  "nonce": "base64-encoded-random-bytes"
}
```

### auth_response

```json
{
  "type": "auth_response",
  "signatureB64": "base64-encoded-signature"
}
```

### exec

```json
{
  "type": "exec",
  "cmd": "whoami"
}
```

### exec_result

```json
{
  "type": "exec_result",
  "stdout": "user\n",
  "stderr": "",
  "code": 0
}
```

### push_begin

```json
{
  "type": "push_begin",
  "remotePath": "/tmp/file.txt"
}
```

### push_chunk

```json
{
  "type": "push_chunk",
  "b64": "base64-encoded-data"
}
```

### pull_begin

```json
{
  "type": "pull_begin",
  "remotePath": "/tmp/file.txt"
}
```

### status_result

```json
{
  "type": "status_result",
  "deviceName": "my-device",
  "pairingMode": "auto",
  "execEnabled": true,
  "pairedCount": 2
}
```

### error

```json
{
  "type": "error",
  "error": "error_code",
  "detail": "Human readable message"
}
```

---

## Discovery Protocol (UDP)

Separate from TCP, used for device discovery on local network.

### Request (Client → Broadcast)

```
UDB_DISCOVER_V1
```

Plain text string sent to UDP port 9909.

### Response (Device → Client)

```json
{
  "name": "device-name",
  "tcpPort": 9910,
  "udpPort": 9909
}
```

---

## Security

### Keypair

- Algorithm: Ed25519
- Client generates keypair on first run
- Stored in `~/.udb/keypair.json`

### Fingerprint

- SHA-256 hash of public key PEM
- First 16 hex characters used as identifier

### Authentication Flow

1. Client sends HELLO with public key
2. If paired: Device sends AUTH_CHALLENGE with random nonce
3. Client signs nonce with private key
4. Client sends AUTH_RESPONSE with signature
5. Device verifies signature matches stored public key
6. If valid: AUTH_OK, else: AUTH_FAIL

---

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 9909 | UDP | Discovery broadcasts |
| 9910 | TCP | Control connection |
