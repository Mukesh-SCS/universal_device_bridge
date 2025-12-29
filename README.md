# UDB — Universal Device Bridge

UDB (Universal Device Bridge) is a **local-first, offline-capable device access tool** inspired by the architecture of Android Debug Bridge (ADB), but designed to work across **non-Android devices** such as Linux systems, embedded platforms, MCUs, simulators, and automotive ECUs.

UDB provides a **single, consistent developer interface** to discover devices, authenticate securely, execute commands, stream logs, and transfer files — without requiring the internet or cloud services.

UDB is an independent project and is not affiliated with Android or Google.

---

## Project Structure

```bash
udb/
│
├── README.md
│
├── cli/                    # Host-side CLI (adb-style client)
│   ├── src/
│   └── package.json
│
├── protocol/               # Shared wire protocol (language-agnostic)
│   ├── spec.md
│   └── frames/
│
├── daemon/
│   ├── linux/              # Linux / Embedded Linux daemon
│   ├── mcu/                # Lightweight MCU daemon (C)
│   ├── simulator/          # Simulator backend
│
├── transport/
│   ├── usb/
│   ├── tcp/
│   └── abstract.ts
│
├── auth/
│   ├── keypair/
│   └── pairing/
│
├── examples/
│   ├── linux-device/
│   ├── mcu-device/
│   └── simulator/
│
└── docs/
    ├── architecture.md
    └── roadmap.md
```

---

## Mission Goal

**Build a universal device access bridge that is:**

- Local-first
- Offline-capable
- Secure by default
- Transport-agnostic
- Cross-platform
- Scriptable and automation-friendly

Inspired by ADB’s architecture, without relying on Android internals.

---

## Core Principles


## Security Model (Important)

UDB follows an **ADB-style trust model**:

- Pairing grants a client persistent access until unpaired/reset.
- Once paired, the client can authenticate using its private key.

### What this means in practice
- If `exec` is enabled on the device daemon, a paired client effectively has remote shell access.
- File transfer is restricted to a sandbox directory by default to reduce damage from mistakes.

### Linux daemon hardening options
The Linux daemon (`udbd`) supports:

- `--no-exec`  
  Disables remote command execution.

- `--root <dir>`  
  Sets the sandbox directory used by `push`/`pull`.  
  Default: `~/.udbd/files`

- `--reset-auth`  
  Clears all paired/authorized keys on daemon startup.

Example:

```bash
node daemon/linux/udbd.js --no-exec --root /var/udbd-files --pairing prompt
```

---

## High-Level Architecture


## High-Level Architecture

UDB follows the same architectural pattern proven by ADB:

```
Host CLI
   |
Unified Device Protocol
   |
-----------------------------
|   |   |   |
Linux MCU Simulator ECU
Daemon Daemon Daemon Daemon
```

### Components

- **Host CLI:**
  - Device discovery
  - Authentication and pairing
  - Command execution
  - File transfer
  - Log streaming
- **Device Daemon:**
  - Runs on the target device
  - Exposes a secure control endpoint
  - Executes platform-specific handlers
- **Protocol Layer:**
  - Versioned
  - Framed or binary
  - Platform-neutral
- **Transport Layer:**
  - USB
  - TCP (local LAN, private networks)
  - Extensible to other transports

---

## Supported / Target Devices

**Initial v1 Targets:**
- Linux (desktop and server)
- Embedded Linux (Raspberry Pi, BeagleBone, Yocto-based systems)
- Simulators (software-only environments)

**Planned Extensions:**
- Microcontrollers (RTOS or bare metal)
- Automotive ECUs
- Robotics platforms
- Android devices (optional, later)

> Android support is not required and not a dependency.  
> UDB is inspired by ADB’s architecture, not built on ADB.

---

## Supported Transports

- USB (CDC / bulk)
- TCP (local LAN, private networks)
- Simulator loopback

Transport selection is abstracted from the protocol.

---

## CLI Experience (Example)

```bash
udb devices
udb connect usb
udb pair
udb exec status
udb logs
udb push firmware.bin /flash
udb reboot
```

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.