# UDB Architecture

Universal Device Bridge is designed as a **local-first, offline-capable** device access system inspired by Android Debug Bridge (ADB), but targeting non-Android devices.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────┐    ┌─────────────┐    ┌─────────────────────┐   │
│  │  udb CLI  │───▶│ @udb/client │───▶│   @udb/protocol     │   │
│  └───────────┘    └─────────────┘    └─────────────────────┘   │
│                                              │                  │
└──────────────────────────────────────────────│──────────────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    │  TCP / UDP / USB    │
                                    └──────────┬──────────┘
                                               │
┌──────────────────────────────────────────────│──────────────────┐
│                         DEVICE SIDE          │                  │
├──────────────────────────────────────────────│──────────────────┤
│                                              ▼                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      udbd (Daemon)                       │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐  │   │
│  │  │  Auth   │  │  Exec   │  │  Push/  │  │  Discovery │  │   │
│  │  │ Pairing │  │ Handler │  │  Pull   │  │   (UDP)    │  │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Target: Linux / Embedded / MCU / Simulator / ECU              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Protocol Layer (`@udb/protocol`)

Wire protocol for all UDB communication:

- **Framing** - Length-prefixed JSON messages
- **Message Types** - HELLO, AUTH, EXEC, PUSH, PULL, etc.
- **Crypto** - Ed25519 keypair-based authentication

```
┌──────────────────────────────────────┐
│  4 bytes   │  N bytes               │
│  Length    │  JSON Payload          │
└──────────────────────────────────────┘
```

### 2. Client Library (`@udb/client`)

Programmatic API for Node.js:

- **Discovery** - UDP broadcast + fallback
- **Connection** - TCP socket management
- **Sessions** - Persistent authenticated connections
- **Operations** - exec, push, pull, status, pair
- **Fleet** - Group management, batch operations

### 3. CLI (`udb`)

Command-line interface wrapping `@udb/client`:

- Device discovery and status
- Pairing management
- Command execution
- File transfer (push/pull)
- Context and group management

### 4. Daemon (`udbd`)

Runs on target devices:

- **Linux daemon** - Full-featured for Linux systems
- **Simulator daemon** - For testing without hardware
- **MCU daemon** - Lightweight for microcontrollers (planned)

---

## Communication Flow

### Discovery

```
Client                                    Device
   │                                         │
   │───────UDP "UDB_DISCOVER_V1"────────────▶│ Port 9909
   │                                         │
   │◀──────{name, tcpPort, udpPort}──────────│
   │                                         │
```

### Authentication

```
Client                                    Device
   │                                         │
   │──────HELLO {clientName, pubKey}────────▶│
   │                                         │
   │◀─────AUTH_CHALLENGE {nonce}─────────────│
   │                                         │
   │──────AUTH_RESPONSE {signature}─────────▶│
   │                                         │
   │◀─────AUTH_OK────────────────────────────│
   │                                         │
```

### Pairing (First Time)

```
Client                                    Device
   │                                         │
   │──────HELLO {clientName, pubKey}────────▶│
   │                                         │
   │◀─────AUTH_REQUIRED─────────────────────│
   │                                         │
   │──────PAIR_REQUEST──────────────────────▶│
   │                                         │
   │◀─────PAIR_OK {fingerprint}──────────────│ (if auto-pair or approved)
   │                                         │
```

---

## Security Model

1. **Keypair Identity** - Each client has Ed25519 keypair
2. **Challenge-Response** - Nonce signed by private key
3. **Fingerprint** - Public key fingerprint for verification
4. **No Central Authority** - All trust is device-local
5. **Revocable** - Devices can unpair clients

---

## Transport Layer

| Transport | Status | Use Case |
|-----------|--------|----------|
| TCP | ✅ Implemented | Primary, works everywhere |
| UDP | ✅ Implemented | Discovery only |
| USB | 🔲 Planned | Direct device connection |
| Serial | 🔲 Planned | MCU/embedded devices |

---

## Target Device Support

| Platform | Daemon | Status |
|----------|--------|--------|
| Linux x86/x64 | udbd.js | ✅ Complete |
| Linux ARM | udbd.js | ✅ Complete |
| Simulator | udbd-sim.js | ✅ Complete |
| MCU (ESP32, etc) | udbd-mcu | 🔲 Planned |
| Automotive ECU | udbd-ecu | 🔲 Planned |

---

## Design Principles

1. **Local-first** - All operations work without internet
2. **Offline-capable** - No cloud dependencies
3. **Explicit** - No magic, clear target specification
4. **Secure** - Cryptographic by default
5. **Scriptable** - CLI + programmatic API
6. **Simple** - No complex orchestration
7. **Composable** - Works in pipelines

---

## File Structure

```
universal_device_bridge/
├── cli/              # Command-line interface
│   └── src/udb.js
├── client/           # Programmatic API (@udb/client)
│   └── src/index.js
├── daemon/           # Device-side daemons
│   ├── linux/udbd.js
│   ├── simulator/udbd-sim.js
│   └── mcu/          # (planned)
├── protocol/         # Wire protocol
│   └── src/
│       ├── framing.js
│       ├── messages.js
│       └── crypto.js
├── transport/        # Transport abstractions
│   ├── abstract.ts
│   ├── tcp/
│   └── usb/
├── scripts/          # Example scripts
└── docs/             # Documentation
```
