# UDB Documentation

Complete documentation for Universal Device Bridge.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Platform Support](#platform-support)
- [CLI Commands](#cli-commands)
- [Context Management](#context-management)
- [Security](#security)
- [Exit Codes](#exit-codes)
- [Reporting Issues](#reporting-issues)

---

## Overview

Universal Device Bridge (UDB) is a **local-first, offline-capable** device access system inspired by Android Debug Bridge (ADB), but targeting non-Android devices like embedded Linux, MCUs, simulators, and automotive ECUs.

### Key Features

- **Device discovery** - Find devices on your network
- **Secure pairing** - Ed25519 keypair-based authentication
- **Command execution** - Run commands remotely
- **File transfer** - Push/pull files to/from devices
- **Interactive shell** - Full PTY-based shell sessions
- **Fleet management** - Manage multiple devices with groups and labels
- **CI-ready** - Scriptable CLI with JSON output

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────┐    ┌─────────────┐    ┌─────────────────────┐    │
│  │  udb CLI  │───▶│ @udb/client │───▶│   @udb/protocol    │    │
│  └───────────┘    └─────────────┘    └─────────────────────┘    │
│                                              │                  │
└──────────────────────────────────────────────│──────────────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    │  TCP / Serial / USB │
                                    └──────────┬──────────┘
                                               │
┌──────────────────────────────────────────────│──────────────────┐
│                         DEVICE SIDE          │                  │
├──────────────────────────────────────────────│──────────────────┤
│                                              ▼                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      udbd (Daemon)                      │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐  │    │
│  │  │  Auth   │  │  Exec   │  │  Push/  │  │  Discovery │  │    │
│  │  │ Pairing │  │ Handler │  │  Pull   │  │   (UDP)    │  │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Targets: Linux / Embedded / MCU / Simulator / ECU              │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Description |
|-----------|-------------|
| **CLI (`udb`)** | Command-line interface for all operations |
| **Client Library** | Node.js API (`@udb/client`) for programmatic use |
| **Daemon (`udbd`)** | Runs on target devices to handle requests |
| **Protocol** | Wire protocol for client-daemon communication |

### Design Principles

- **Local-first** - Works without internet
- **Offline-capable** - No cloud dependencies
- **Secure** - Cryptographic authentication by default
- **Scriptable** - CLI + programmatic API
- **Simple** - No complex orchestration

---

## Installation

### One-Line Install

**Linux / macOS:**
```bash
curl -fsSL https://udb-core.pages.dev/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://udb-core.pages.dev/install.ps1 | iex
```

### npm Install

```bash
npm install -g @udb/cli
```

### Manual Download

Download prebuilt binaries from [GitHub Releases](https://github.com/Mukesh-SCS/universal_device_bridge/releases).

---

## Platform Support

### Prebuilt Binaries

| Platform | Architecture |
|----------|-------------|
| Linux | x86_64 |
| Linux | ARM64 |
| macOS | Intel |
| macOS | Apple Silicon |
| Windows | x86_64 |

### Node.js Runtime (npm usage)

| Node.js Version | Notes |
|----------------|-------|
| 22.x | Recommended |
| 20.x LTS | Supported |
| 18.x LTS | Minimum |

### Target Device Support

| Platform |
|----------|
| Linux x86/x64 |
| Linux ARM |
| Simulator |
| Serial devices |

---

## CLI Commands

### Connection Management

```bash
# Connect to a device (sets as default context)
udb connect <ip:port | device-name>

# Disconnect from current device
udb disconnect
```

**After `udb connect`, you can omit the IP address for subsequent commands:**
```bash
udb connect 10.0.0.1:9910
udb pair              # No IP needed
udb exec "whoami"     # No IP needed
udb shell             # No IP needed
```

### Device Operations

```bash
# Discover devices
udb devices [--json]

# Get device status
udb status [ip:port] [--json]

# Pair with device (uses current context if IP omitted)
udb pair [ip:port]

# Unpair from device
udb unpair [ip:port] [--all | --fp <fingerprint>]

# List paired clients
udb list-paired [ip:port] [--json]

# Execute command (uses current context if IP omitted)
udb exec [ip:port] "<cmd>"

# Interactive shell
udb shell [ip:port]

# File transfer
udb push [ip:port] <local-path> <remote-path>
udb pull [ip:port] <remote-path> <local-path>
```

---

## Context Management

UDB uses **contexts** to remember device addresses, so you don't need to specify the IP for every command.

### Default Context (via `connect`)

```bash
# Connect sets a "default" context
udb connect 10.0.0.1:9910

# All commands now use this device
udb pair
udb exec "whoami"
udb shell

# Disconnect clears the default context
udb disconnect
```

### Named Contexts

```bash
# Create a named context
udb context add production 10.0.0.100:9910
udb context add staging 10.0.1.100:9910

# Switch between contexts
udb context use production
udb exec "hostname"  # Runs on production

udb context use staging
udb exec "hostname"  # Runs on staging

# List all contexts
udb context list
```

### Context Resolution Order

When a command doesn't specify an IP address, UDB resolves the target in this order:

1. **Explicit target** - If `ip:port` is provided, use it
2. **Current context** - Use the active context (set by `connect` or `context use`)
3. **Last target** - Use the last device you connected to
4. **Discovery** - Try to discover a single device on the network

---

## Security

### Security Model

UDB uses Ed25519 keypair-based authentication:

1. **Keypair Identity** - Each client has a unique keypair
2. **Challenge-Response** - Devices verify clients via signed nonces
3. **Fingerprint** - Public key fingerprints for verification
4. **No Central Authority** - All trust is device-local
5. **Revocable** - Devices can unpair clients at any time

### Key Storage

```
~/.udb/
├── keys/
│   ├── client.key        # Private key (0600)
│   ├── client.pub        # Public key
│   └── known_devices/    # Paired device keys
└── config.json
```

### Secure Defaults

| Setting | Default |
|---------|---------|
| Auth Required | Yes |
| Pairing Required | Yes |
| Key Permissions | 0600 |
| Connection Timeout | 30s |

### Security Checklist

- [ ] Keep UDB updated
- [ ] Protect `~/.udb/keys/` directory
- [ ] Review paired devices regularly (`udb devices`)
- [ ] Use on trusted networks only

---

## Exit Codes

### Standard Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error (connection, auth, runtime) |
| `2` | Usage error (invalid arguments) |

### `udb exec` Exit Codes

The `exec` command returns the remote command's exit code:

| Code | Description |
|------|-------------|
| `0` | Remote command succeeded |
| `1-125` | Remote command's exit code |
| `126` | Command not executable |
| `127` | Command not found |

### Scripting Example

```bash
# Check device reachability
if udb ping 10.0.0.1:9910; then
  echo "Device online"
else
  echo "Device offline"
fi

# Capture command output
result=$(udb exec 10.0.0.1:9910 "whoami")
echo "User: $result"
```

---

## Reporting Issues

### Bug Reports

Report bugs at: https://github.com/Mukesh-SCS/universal_device_bridge/issues

### Security Vulnerabilities

**Do not report security vulnerabilities through public GitHub issues.**

Email: tripathimukeshmani@outlook.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact

### Response Timeline

| Phase | Timeline |
|-------|----------|
| Initial Response | 24-48 hours |
| Triage | 1 week |
| Fix (critical) | 2 weeks |
| Fix (high) | 4 weeks |

---

## License

MIT License - see [LICENSE](../LICENSE) for details.
