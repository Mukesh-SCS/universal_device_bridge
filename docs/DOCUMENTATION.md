# UDB Documentation

Complete documentation for Universal Device Bridge.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Platform Support](#platform-support)
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
│  ┌───────────┐    ┌─────────────┐    ┌─────────────────────┐   │
│  │  udb CLI  │───▶│ @udb/client │───▶│   @udb/protocol     │   │
│  └───────────┘    └─────────────┘    └─────────────────────┘   │
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
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      udbd (Daemon)                       │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐  │   │
│  │  │  Auth   │  │  Exec   │  │  Push/  │  │  Discovery │  │   │
│  │  │ Pairing │  │ Handler │  │  Pull   │  │   (UDP)    │  │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Targets: Linux / Embedded / MCU / Simulator / ECU             │
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
curl -fsSL https://udb.dev/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://udb.dev/install.ps1 | iex
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
