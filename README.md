
# Universal Device Bridge (UDB)

Universal Device Bridge (UDB) is a **local-first, offline-capable device access tool** inspired by the architecture of Android Debug Bridge (ADB), but designed to work across **non-Android devices** such as:

- **Linux systems** (servers, embedded Linux)
- **Embedded platforms** (IoT devices, SBCs)
- **MCUs** (microcontrollers via serial/TCP)
- **Simulators** (virtual device testing)
- **Automotive ECUs** (vehicle embedded systems)

UDB provides a lightweight, secure, and scriptable system for discovering devices, pairing with them, and executing commands locally or remotely.

It works reliably across:
- Local networks (with or without UDP broadcast)
- Windows, Linux, and macOS environments
- Restricted/air-gapped networks
- Cloud and CI/CD systems

It provides a deterministic CLI experience similar in philosophy to tools like `kubectl` and `adb`, but without relying on fragile assumptions.

---

## Key Features

- **Device discovery** (UDP fast path with fallback)
- **Context-based device management** (save & reuse known devices)
- **Explicit remote targets** (`tcp://host:port`)
- **Secure pairing and authorization** (cryptographic keypairs)
- **Command execution** (with stdout/stderr)
- **Programmatic API** (`@udb/client` - execute UDB from Node.js)
- **Batch operations** (run commands across multiple devices)
- **Fleet management** (logical grouping and labeling)
- **JSON output for automation**
- **100% offline** (no cloud, no telemetry)

---

## Architecture Overview

UDB consists of:

- **Daemon (`udbd`)** - Runs on target device, exposes TCP control interface
- **CLI (`udb`)** - Command-line tool for operators and scripts
- **Client API (`@udb/client`)** - Programmatic API for automation

Communication is authenticated using cryptographic keypairs and explicit pairing.

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

---

## Platform Support

Universal Device Bridge (UDB) provides prebuilt binaries for the following platforms:

| Platform | Architecture | Status |
|--------|-------------|--------|
| Linux | x86_64 | ✅ Fully supported |
| Linux | arm64 | ✅ Fully supported |
| Windows | x86_64 | ✅ Fully supported |
| macOS | arm64 (Apple Silicon) | ✅ Fully supported |
| macOS | x86_64 (Intel) | ⚠️ Best-effort / legacy |

### Notes

- Apple Silicon (M1/M2/M3) is the primary macOS target.
- Intel macOS (x86_64) support is **best-effort only** and may be removed in future releases due to upstream GitHub Actions runner deprecations.
- macOS users on Intel hardware are encouraged to migrate to Apple Silicon or build from source if required.



### npm Install

```bash
npm install -g @udb/cli
```

### Manual Download

Download prebuilt binaries from [GitHub Releases](https://github.com/Mukesh-SCS/universal_device_bridge/releases).

---

## Quick Start 

### 1. Start the daemon

```bash
# On target device (or use udb daemon start)
udb daemon start
```

### 2. Discover devices

```bash
udb devices
udb devices --json
```

### 3. Connect and pair

```bash
# Connect to device (sets as default context)
udb connect 10.0.0.1:9910

# Pair with device (IP not needed after connect)
udb pair

# Execute commands (IP not needed)
udb exec "whoami"
udb shell
```

**Note:** After `udb connect`, you can omit the IP address for subsequent commands. Use `udb disconnect` to clear the connection.

---

## CLI Usage

### Device Operations

```bash
# Discover devices on network
udb devices [--json]

# Connect to device (sets as default context)
udb connect <ip:port | device-name>

# Disconnect from current device
udb disconnect

# Get device status
udb status [ip:port] [--json]

# Pair with device (uses current context if IP omitted)
udb pair [ip:port]

# Unpair from device
udb unpair [ip:port] [--all | --fp <fingerprint>]

# Execute command (uses current context if IP omitted)
udb exec [ip:port] "<cmd>"

# Push file to device
udb push [ip:port] <local-path> <remote-path>

# Pull file from device
udb pull [ip:port] <remote-path> <local-path>

# List paired clients
udb list-paired [ip:port] [--json]
```

### Context Management

```bash
# Connect to device (creates "default" context)
udb connect 10.0.0.1:9910

# All commands now use this device (IP not needed)
udb pair
udb exec "whoami"
udb shell

# Disconnect (clears default context)
udb disconnect

# Save a device as a named context
udb context add lab 10.0.0.1:9910

# Select active context
udb context use lab

# List contexts
udb context list [--json]

# Once context is active, all commands target it
udb exec "whoami"
```

### Fleet Management

```bash
# Create a device group
udb group add lab 10.0.0.1:9910 10.0.0.2:9910

# Execute on entire group
udb group exec lab "uname -a"

# List groups
udb group list [--json]

# Export fleet inventory
udb inventory [--json]
```

### Configuration

```bash
# View configuration
udb config show [--json]

# Daemon management
udb daemon start
udb daemon stop
udb daemon status
```

---

## Programmatic API

Execute UDB operations from Node.js scripts or applications:

```javascript
import { exec, status, pair, discoverDevices } from "@udb/client";

// Discover devices
const devices = await discoverDevices();

// Execute command
const result = await exec("10.0.0.1:9910", "whoami");
console.log(result.stdout); // "user\n"

// Get device status
const info = await status("10.0.0.1:9910");
console.log(info.name); // "device-name"

// Pair with device
const pair_result = await pair("10.0.0.1:9910");
console.log(pair_result.fingerprint);
```

### Advanced Features

**Persistent Sessions:**
```javascript
const session = await createSession("10.0.0.1:9910");
await session.exec("cmd1");
await session.exec("cmd2");
await session.close();
```

**Batch Execution:**
```javascript
const results = await execBatch(devices, "whoami", { parallel: true });
```

**Fleet Operations:**
```javascript
import { createGroup, execOnGroup } from "@udb/client/fleet";

createGroup("lab", devices);
const results = await execOnGroup("lab", "uname -a");
```

---

## Discovery Strategy

UDB uses layered device discovery:

1. **UDP broadcast** (fast, local network)
2. **Saved contexts** (reliable fallback)
3. **Explicit targets** (always available)

This ensures UDB works everywhere:
- Local networks with broadcast
- Restricted networks without UDP
- Cloud environments
- CI/CD systems

---

## Contexts

Contexts save device addresses locally for easy access:

```bash
# Add context
udb context add production 10.0.0.100:9910
udb context add staging 10.0.1.100:9910

# Use context
udb context use production

# Commands now target this device
udb exec "hostname"
udb status
```

Contexts are stored in `~/.udb/config.json` and work offline.

---

## Security Model

- **Explicit pairing** - Devices must approve first connection
- **Cryptographic keypairs** - Each client has unique keypair
- **Fingerprint verification** - Optional pairing confirmation
- **Revocable access** - Unpair to revoke client access
- **No global trust** - No central authority needed

---

## Examples

### Example 1: Basic execution

```bash
# Connect and pair
udb connect 10.0.0.1:9910
udb pair

# Execute commands (no IP needed)
udb exec "uptime"
udb shell
```

### Example 2: Using contexts

```bash
# Connect creates default context
udb connect 10.0.0.1:9910
udb exec "df -h"

# Or use named contexts
udb context add lab 10.0.0.1:9910
udb context use lab
udb exec "df -h"
udb status --json
```

### Example 3: Fleet operation

```bash
udb group add lab 10.0.0.1:9910 10.0.0.2:9910 10.0.0.3:9910
udb group exec lab "systemctl status nginx"
udb inventory --json > fleet.json
```

### Example 4: Programmatic usage

```javascript
// See scripts/ folder for full examples
node scripts/devices.js
node scripts/exec.js
node scripts/context.js 10.0.0.1:9910
node scripts/pair.js
node scripts/group.js 10.0.0.1:9910
```

---

## Configuration

UDB stores configuration in `~/.udb/config.json`:

```json
{
  "lastTarget": { "host": "10.0.0.1", "port": 9910 },
  "currentContext": "lab",
  "contexts": {
    "lab": { "host": "10.0.0.1", "port": 9910, "name": "lab-device" }
  }
}
```

View configuration:
```bash
udb config show
udb config show --json
```

---

## Documentation

- [Documentation](docs/DOCUMENTATION.md) - Complete UDB documentation
- [API Reference](client/API.md) - Programmatic API details
- [Quick Reference](client/QUICK_REFERENCE.md) - Quick start guide

---

## Design Philosophy

UDB follows these principles:

1. **Local-first** - All operations work offline
2. **Explicit** - No magic, clear target specification
3. **Secure** - Cryptographic by default
4. **Scriptable** - Both CLI and programmatic APIs
5. **Reliable** - Deterministic behavior across platforms
6. **Simple** - No complex orchestration
7. **Composable** - Works in pipelines and automation

---

## 100% Offline

UDB requires **no cloud connection**:
- Discovery works on local networks
- Pairing is local-only
- No telemetry
- No external dependencies
- Works in air-gapped environments

---

## License

This project is licensed under the Apache-2.0 License. See the LICENSE file for details.