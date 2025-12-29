
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

- Device discovery (UDP fast path)
- Context-based device management
- Explicit remote targets (`tcp://`)
- Secure pairing and authorization
- Command execution
- JSON output for automation
- Windows-safe behavior (no dependency on UDP)

---

## Architecture Overview

UDB consists of two main components:

- **Daemon (`udbd`)**  
  Runs on the target device and exposes a TCP control interface.

- **CLI (`udb`)**  
  Used by operators, scripts, and automation to discover, connect, and execute commands.

Communication is authenticated and uses explicit pairing.

---

## Quick Start 

### 1. Start the daemon (on the target machine)

```bash
node daemon/linux/udbd.js --pairing auto
```

Example output:

```
UDBD listening TCP on :9910
```

### 2. Discover devices

```bash
udb devices
udb devices --json
```

Discovery uses UDP when available and falls back to known contexts when not.

### 3. Connect and pair

```bash
udb connect 192.168.56.1:9910
udb pair
```

Once paired, the device authorizes future connections from this client.

### 4. Execute commands

```bash
udb exec "whoami"
udb status
udb status --json
```

---

## Contexts

Contexts allow you to work with multiple devices without repeatedly typing IP addresses.

**Add a context**

```bash
udb context add lab 192.168.56.1:9910
```

**Select a context**

```bash
udb context use lab
```

**List contexts**

```bash
udb context list
udb context list --json
```

Once a context is selected, all commands automatically target it:

```bash
udb exec "whoami"
udb status
```

Contexts are stored locally and do not require discovery to function.

---

## Device Discovery Model

UDB uses a layered discovery strategy:

- UDP broadcast (fast path on local networks)
- Saved contexts (reliable fallback)
- Explicit targets (ip:port or tcp://)

If UDP discovery is unavailable (common on Windows or restricted networks), UDB continues to work using contexts and explicit targets.

---

## Remote Targets (Explicit URLs)

UDB supports explicit remote targets using URL syntax.

**TCP targets**

```bash
udb connect tcp://host:9910
udb exec tcp://host:9910 "uptime"
udb status tcp://host:9910
```

URL targets:

- bypass discovery
- bypass contexts
- are always explicit

This makes UDB suitable for:

- cloud VMs
- CI runners
- remote labs
- cross-network access

---

## CLI Examples 

```bash
# Discover devices
udb devices
udb devices --json

# Connect and pair
udb connect 192.168.56.1:9910
udb pair

# Context management
udb context add lab 192.168.56.1:9910
udb context use lab
udb context list

# Execute commands
udb exec "whoami"

# Status
udb status
udb status --json

# Remote targets
udb connect tcp://example.com:9910
udb exec tcp://example.com:9910 "uptime"
```

---

## Security Model

- Devices require explicit pairing
- Clients are identified using cryptographic keypairs
- Unpaired clients cannot execute commands
- Pairing can be revoked at any time
- Security decisions are enforced by the daemon.

---

## Configuration

UDB stores local configuration in:

```bash
~/.udb/config.json
```

This includes:

- saved contexts
- current context
- last-used target

**View configuration:**

```bash
udb config show
udb config show --json
```

---

## Project Status

- Phase 1: Core CLI + daemon (Complete)
- Phase 2: Contexts, discovery fallback, remote targets (Complete)

Current version: stable

Future phases may introduce:

- SSH targets
- file transfer
- remote forwarding
- access control


## License

This project is licensed under the Apache-2.0 License. See the LICENSE file for details.