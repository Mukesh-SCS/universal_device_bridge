
# Universal Device Bridge (UDB)

Universal Device Bridge (UDB) is a lightweight, secure, and scriptable system for discovering devices, pairing with them, and executing commands locally or remotely.

UDB is designed to work reliably across:
- local networks
- Windows environments
- restricted networks
- cloud and CI systems

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

## Quick Start 

### 1. Start the daemon (on target machine)

```bash
node daemon/linux/udbd.js --pairing auto
```

Output:
```
UDBD listening TCP on :9910
```

### 2. Discover devices

```bash
udb devices
udb devices --json
```

### 3. Pair and execute

```bash
udb pair 192.168.1.100:9910
udb exec "whoami"
```

---

## CLI Usage

### Device Operations

```bash
# Discover devices on network
udb devices [--json]

# Get device status
udb status [ip:port] [--json]

# Pair with device
udb pair <ip:port>

# Unpair from device
udb unpair <ip:port> [--all | --fp <fingerprint>]

# Execute command
udb exec [ip:port] "<cmd>"

# List paired clients
udb list-paired <ip:port> [--json]
```

### Context Management

```bash
# Save a device as a context
udb context add lab 192.168.1.100:9910

# Select active context
udb context use lab

# List contexts
udb context list [--json]

# Once context is active, all commands target it
udb exec "whoami"
```

### Fleet Management (Phase 3)

```bash
# Create a device group
udb group add lab 192.168.1.100:9910 192.168.1.101:9910

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
const result = await exec("192.168.1.100:9910", "whoami");
console.log(result.stdout); // "user\n"

// Get device status
const info = await status("192.168.1.100:9910");
console.log(info.name); // "device-name"

// Pair with device
const pair_result = await pair("192.168.1.100:9910");
console.log(pair_result.fingerprint);
```

### Advanced Features

**Persistent Sessions:**
```javascript
const session = await createSession("192.168.1.100:9910");
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

## Project Status

| Phase | Status | Features |
|-------|--------|----------|
| 1 | ✅ Complete | Core CLI, daemon, protocol, security |
| 2 | ✅ Complete | Contexts, discovery fallback, remote targets |
| 3 | ✅ Complete | Programmatic API, batch ops, fleet management |

**Current version:** v0.3.0 (Phase 3)

---

## Examples

### Example 1: Basic execution

```bash
udb pair 192.168.1.100:9910
udb exec "uptime"
```

### Example 2: Using contexts

```bash
udb context add lab 192.168.1.100:9910
udb context use lab
udb exec "df -h"
udb status --json
```

### Example 3: Fleet operation

```bash
udb group add lab 192.168.1.100:9910 192.168.1.101:9910 192.168.1.102:9910
udb group exec lab "systemctl status nginx"
udb inventory --json > fleet.json
```

### Example 4: Programmatic usage

```javascript
// See scripts/ folder for full examples
node scripts/01-discover.js
node scripts/02-batch-exec.js
node scripts/03-session.js 192.168.1.100:9910
node scripts/04-contexts.js
node scripts/05-error-handling.js 192.168.1.100:9910
```

---

## Configuration

UDB stores configuration in `~/.udb/config.json`:

```json
{
  "lastTarget": { "host": "192.168.1.100", "port": 9910 },
  "currentContext": "lab",
  "contexts": {
    "lab": { "host": "192.168.1.100", "port": 9910, "name": "lab-device" }
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

- [Phase 3 Implementation Plan](docs/PHASE3_PLAN.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [API Reference](client/API.md)
- [Example Scripts](scripts/README.md)

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