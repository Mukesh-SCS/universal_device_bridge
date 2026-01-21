# Phase 4 Implementation Plan

**Goal:** Hardening + extensibility. No cloud, no GUI, no orchestration.

**Status:** ✅ COMPLETE

**Deliverables:**
- ✅ Protocol version negotiation
- ✅ Capabilities discovery (services service)
- ✅ Daemon info (info service)
- ✅ Transport boundary abstraction
- ✅ Doctor command

---

## Pre-Implementation Checklist

- [x] Verify Phase 3 complete (all tests pass)
- [x] Sanity tests:
  - [x] `udb devices` - works
  - [x] `udb status` - works
  - [x] `udb pair` - works
  - [x] `udb exec "whoami"` - works
  - [x] `udb push/pull` - works
  - [x] `udb shell` - works

---

## Step 1 — Protocol Version Negotiation (HELLO v1) ✅

### 1.1 Add Constants
- [x] In `@udb/protocol/src/messages.js`:
  - Added `PROTOCOL_VERSION = 1`
  - Updated `hello()` function to include protocol

### 1.2 Client: Send Protocol in HELLO
- [x] In `@udb/client/src/index.js`:
  - Modified `tcpRequest()` HELLO to include `protocol: 1`
  - Modified `UdbSession.connect()` HELLO to include `protocol: 1`

### 1.3 Daemon: Validate Protocol
- [x] In `daemon/linux/udbd.js`:
  - On MSG.HELLO, check `m.protocol`
  - If missing: treat as 1 (backward compat)
  - If > supported: reply error and close
- [x] In `daemon/simulator/udbd-sim.js`: Same validation
- [x] In `daemon/mcu/udbd-mcu.js`: Same validation

### 1.4 Test
- [x] Old client (without protocol) still works
- [x] New client works
- [x] All 79 tests pass

---

## Step 2 — Service Discovery (services service) ✅

### 2.1 Define Service Behavior
- [x] Service name: `services`
- [x] Mechanism: OPEN_SERVICE → STREAM_DATA → STREAM_CLOSE
- [x] Payload: JSON with service capabilities

### 2.2 Daemon: Handle OPEN_SERVICE for "services"
- [x] In `daemon/linux/udbd.js`:
  - Added handler for `serviceName === "services"`
  - Sends STREAM_DATA with capabilities JSON
  - Sends STREAM_CLOSE
  - Allowed pre-auth access
- [x] In `daemon/simulator/udbd-sim.js`: Same implementation

### 2.3 Client: Add getServices() API
- [x] In `client/src/index.js`:
  - Added `getServices(target)` function
  - Uses OPEN_SERVICE, waits for STREAM_DATA, parses JSON

### 2.4 CLI: Add udb services
- [x] In `cli/src/udb.js`:
  - Added `servicesCmd()`
  - Supports `--json` flag

### 2.5 Test
- [x] `udb services` prints capabilities
- [x] Works without pairing (pre-auth)

---

## Step 3 — Daemon Info Service ✅

### 3.1 Define Info Payload
- [x] Includes: name, version, build, platform, arch, ports, protocol

### 3.2 Daemon: Handle OPEN_SERVICE for "info"
- [x] Same pattern as services
- [x] Allowed pre-auth access
- [x] Implemented in Linux daemon and simulator

### 3.3 Client: Add getInfo() API
- [x] In `client/src/index.js`:
  - Added `getInfo(target)` function

### 3.4 CLI: Add udb info
- [x] In `cli/src/udb.js`:
  - Added `infoCmd()`
  - Supports `--json` flag

---

## Step 4 — Transport Boundary ✅

### 4.1 Create Transport Interface
- [x] Created `client/src/transport/transport.js`:
  - Defined interface: connect, write, end, destroy, onData, onError, onClose, isConnected

### 4.2 Implement TcpTransport
- [x] Created `client/src/transport/tcp.js`:
  - Wraps net.Socket
  - Implements Transport interface

### 4.3 Refactor Client to Use Transport
- [x] In `tcpRequest()`: now uses TcpTransport
- [x] Supports optional custom transport parameter
- [x] No protocol/framing changes
- [x] Exported Transport classes from client module

---

## Step 5 — Doctor Command ✅

### 5.1 Implement Checks
- [x] Added `udb doctor [ip:port]`:
  - Checks config directory
  - Checks client keypair
  - Lists contexts
  - Resolves target
  - Tests TCP connectivity
  - Queries device info (pre-auth)
  - Checks authentication status
  - Provides actionable hints for failures

---

## Definition of Done ✅

- [x] HELLO includes protocol version, daemon validates it
- [x] `udb services` works and prints capabilities
- [x] `udb info` works and prints daemon metadata
- [x] Client transport boundary exists; TCP is implementation
- [x] `udb doctor` provides comprehensive diagnostics
- [x] All Phase 3 commands still work (devices/status/pair/exec/shell/push/pull)
- [x] All 79 tests pass

---

## Hard Constraints

1. **Backward compatibility** - Accept missing protocol field as v1 ✅
2. **No new message types** - Use existing OPEN_SERVICE/STREAM_DATA pattern ✅
3. **Services as services** - Keep Device→Service→Stream model pure ✅

---

## Files Modified/Created

### Protocol
- `protocol/src/messages.js` - Added PROTOCOL_VERSION constant

### Client
- `client/src/index.js` - Added getServices(), getInfo(), transport support
- `client/src/transport/transport.js` - NEW: Transport interface
- `client/src/transport/tcp.js` - NEW: TcpTransport implementation
- `client/src/transport/index.js` - NEW: Transport exports

### CLI
- `cli/src/udb.js` - Added services, info, doctor commands

### Daemons
- `daemon/linux/udbd.js` - Protocol validation, services/info handlers
- `daemon/simulator/udbd-sim.js` - Protocol validation, services/info handlers
- `daemon/mcu/udbd-mcu.js` - Protocol validation
