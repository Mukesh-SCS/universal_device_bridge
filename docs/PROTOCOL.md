# UDB Protocol Specification

**Version:** 1  
**Status:** Stable  
**Last Updated:** 2026-01-21

## Overview

UDB uses a simple, transport-independent protocol for communication between clients and daemons. The protocol is designed for:

- **Transport Independence:** Works over TCP, Serial, USB, or any byte stream
- **Backward Compatibility:** Older clients work with newer daemons
- **Low Overhead:** Length-prefixed JSON frames
- **Security:** Ed25519 keypair authentication

## Wire Format

### Frame Structure

Every message is a length-prefixed JSON frame:

```
[4 bytes: uint32 big-endian length][JSON payload]
```

Example:
```
00 00 00 1e {"type":"HELLO","protocol":1}
```

### Maximum Frame Size

- **Default maximum:** 1 MB (1,048,576 bytes)
- Frames exceeding this limit are rejected

## Protocol Version

The protocol version is negotiated during the HELLO handshake:

| Version | Status | Notes |
|---------|--------|-------|
| 1 | **Stable** | Current version |

### Version Negotiation

1. Client sends `HELLO` with `protocol: 1`
2. Daemon checks if version is supported
3. If unsupported: daemon sends `ERROR` with `unsupported_protocol`
4. If missing: daemon assumes version 1 (backward compatibility)

## Message Types

### Connection & Authentication

| Type | Direction | Description |
|------|-----------|-------------|
| `HELLO` | C→D | Initial handshake with public key |
| `AUTH_REQUIRED` | D→C | Device requires pairing |
| `AUTH_CHALLENGE` | D→C | Nonce challenge for authentication |
| `AUTH_RESPONSE` | C→D | Signed nonce response |
| `AUTH_OK` | D→C | Authentication successful |
| `AUTH_FAIL` | D→C | Authentication failed |
| `ERROR` | D→C | Protocol/system error |

### Pairing

| Type | Direction | Description |
|------|-----------|-------------|
| `PAIR_REQUEST` | C→D | Request to pair client key |
| `PAIR_OK` | D→C | Pairing successful |
| `PAIR_DENIED` | D→C | Pairing rejected |
| `UNPAIR_REQUEST` | C→D | Request to unpair |
| `UNPAIR_OK` | D→C | Unpair successful |
| `LIST_PAIRED` | C→D | List paired clients |
| `LIST_PAIRED_RESULT` | D→C | Paired clients list |

### Status & Commands

| Type | Direction | Description |
|------|-----------|-------------|
| `STATUS` | C→D | Request device status |
| `STATUS_RESULT` | D→C | Device status response |
| `EXEC` | C→D | Execute command |
| `EXEC_RESULT` | D→C | Command result |

### Services & Streams

| Type | Direction | Description |
|------|-----------|-------------|
| `OPEN_SERVICE` | C→D | Open a named service |
| `STREAM_DATA` | Both | Data on a stream |
| `STREAM_CLOSE` | Both | Close a stream |
| `STREAM_RESIZE` | C→D | Resize terminal (PTY) |
| `SERVICE_ERROR` | D→C | Service-level error |

### File Transfer

| Type | Direction | Description |
|------|-----------|-------------|
| `FILE_PUSH_START` | C→D | Start file upload |
| `FILE_PUSH_CHUNK` | C→D | File data chunk |
| `FILE_PUSH_END` | D→C | Upload complete |
| `FILE_PULL_START` | C→D | Request file download |
| `FILE_PULL_CHUNK` | D→C | File data chunk |
| `FILE_PULL_END` | D→C | Download complete |
| `FILE_ERROR` | D→C | File operation error |

## HELLO Message

```json
{
  "type": "HELLO",
  "clientName": "udb-client",
  "pubKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "protocol": 1
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Must be `"HELLO"` |
| `clientName` | No | Human-readable client name |
| `pubKey` | Yes | Ed25519 public key in PEM format |
| `protocol` | No | Protocol version (default: 1) |

## Services

Services are opened with `OPEN_SERVICE` and communicate via `STREAM_DATA`:

### Pre-Auth Services

These services work without authentication:

| Service | Description |
|---------|-------------|
| `services` | List available services and capabilities |
| `info` | Daemon metadata (version, platform, etc.) |
| `ping` | Health check (returns pong with latency) |

### Auth-Required Services

| Service | Description |
|---------|-------------|
| `shell` | Interactive shell (PTY) |
| `exec` | Command execution (stream) |
| `logs` | Log streaming |
| `shutdown` | Shutdown daemon |
| `restart` | Restart daemon |

## Authentication Flow

### Initial Pairing

```
Client                          Daemon
  |                               |
  |  HELLO (pubKey)               |
  |------------------------------>|
  |                               |
  |  AUTH_REQUIRED                |
  |<------------------------------|
  |                               |
  |  PAIR_REQUEST                 |
  |------------------------------>|
  |                               |
  |  PAIR_OK / PAIR_DENIED        |
  |<------------------------------|
```

### Subsequent Authentication

```
Client                          Daemon
  |                               |
  |  HELLO (pubKey)               |
  |------------------------------>|
  |                               |
  |  AUTH_CHALLENGE (nonce)       |
  |<------------------------------|
  |                               |
  |  AUTH_RESPONSE (signature)    |
  |------------------------------>|
  |                               |
  |  AUTH_OK / AUTH_FAIL          |
  |<------------------------------|
```

## Cryptography

- **Key Type:** Ed25519
- **Key Format:** PEM (SPKI for public, PKCS#8 for private)
- **Signature:** Ed25519 signature of challenge nonce
- **Fingerprint:** First 16 hex chars of SHA-256 of public key

## Backward Compatibility

### Rules

1. **Missing `protocol` field:** Treated as protocol version 1
2. **Unknown message types:** Daemons should respond with `ERROR`
3. **Extra fields:** Ignored (allows forward compatibility)
4. **New services:** Require `OPEN_SERVICE`, return `SERVICE_ERROR` if unknown

### Deprecation Policy

- Protocol v1 will be supported indefinitely
- Future versions will be negotiated, never forced
- Breaking changes require new version number

## Transport Requirements

Any transport can be used if it provides:

1. **Reliable byte stream:** No packet loss, in-order delivery
2. **Full duplex:** Bidirectional communication
3. **Frame boundary preservation:** Not required (protocol handles framing)

### Tested Transports

- TCP/IP (primary)
- Serial/UART (embedded devices)

## Error Handling

### Error Message

```json
{
  "type": "ERROR",
  "error": "error_code",
  "message": "Human readable message"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `unsupported_protocol` | Protocol version not supported |
| `missing_pubkey` | HELLO without public key |
| `hello_required` | Operation without HELLO |
| `nonce_expired` | Auth challenge expired |
| `bad_signature` | Signature verification failed |
| `auth_required` | Operation requires authentication |
| `unknown_service` | Service not found |

## Reference Implementation

- **Client:** `@udb/client` (JavaScript/Node.js)
- **Protocol:** `@udb/protocol` (JavaScript/Node.js)
- **Daemons:** `daemon/linux`, `daemon/simulator`, `daemon/serial`
