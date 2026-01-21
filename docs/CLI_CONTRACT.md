# UDB CLI Contract

This document defines the contract for the UDB command-line interface. All CLI behavior should follow these rules to ensure scriptability and automation.

## Exit Codes

| Code | Meaning | When |
|------|---------|------|
| `0` | Success | Command completed successfully |
| `1` | General error | Connection, auth, or command failure |
| `2` | Usage error | Invalid arguments, missing required params |
| `N` | Command exit code | `udb exec` returns the remote command's exit code |

### Exit Code by Command

| Command | Success | Connection Error | Auth Error | Usage Error |
|---------|---------|------------------|------------|-------------|
| `devices` | 0 | 0 (empty list) | N/A | 2 |
| `status` | 0 | 1 | 1 | 2 |
| `services` | 0 | 1 | N/A | 2 |
| `info` | 0 | 1 | N/A | 2 |
| `ping` | 0 | 1 | N/A | 2 |
| `pair` | 0 | 1 | N/A | 2 |
| `unpair` | 0 | 1 | 1 | 2 |
| `exec` | N | 1 | 1 | 2 |
| `shell` | 0 | 1 | 1 | 2 |
| `push` | 0 | 1 | 1 | 2 |
| `pull` | 0 | 1 | 1 | 2 |
| `doctor` | 0 | 0 | 0 | 2 |
| `list-paired` | 0 | 1 | 1 | 2 |
| `context *` | 0 | 1 | N/A | 2 |
| `group *` | 0 | 1 | 1 | 2 |
| `inventory` | 0 | N/A | N/A | 2 |

---

## Output Streams

| Stream | Content |
|--------|---------|
| `stdout` | Normal output, JSON when `--json` is used |
| `stderr` | Error messages, warnings, progress indicators |

### Rules

1. **Errors always go to stderr**
2. **JSON output goes to stdout only**
3. **Progress/status messages go to stderr when `--json` is used**

---

## JSON Mode

Every command supports `--json` for machine-readable output.

### JSON Output Structure

```json
{
  "success": true,
  "data": { ... }
}
```

Or on error:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| `CONNECTION_FAILED` | TCP/serial connection failed |
| `AUTH_FAILED` | Not paired, authentication rejected |
| `COMMAND_FAILED` | Remote command returned non-zero exit |
| `INVALID_TARGET` | Target format invalid |
| `NO_TARGET` | No target specified and none in context |
| `SERVICE_NOT_FOUND` | Requested service doesn't exist |
| `TIMEOUT` | Operation timed out |
| `PROTOCOL_ERROR` | Wire protocol error |

---

## Target Format

All commands accept targets in these formats:

| Format | Example | Notes |
|--------|---------|-------|
| `ip:port` | `10.0.0.1:9910` | TCP connection |
| `tcp://ip:port` | `tcp://10.0.0.1:9910` | Explicit TCP |
| `serial://path` | `serial:///dev/ttyUSB0?baud=115200` | Serial connection |
| `name` | `lab-device` | Resolve via discovery |

### Serial URL Parameters

| Parameter | Default | Values |
|-----------|---------|--------|
| `baud` | 115200 | 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600 |
| `dataBits` | 8 | 5, 6, 7, 8 |
| `stopBits` | 1 | 1, 1.5, 2 |
| `parity` | none | none, even, odd, mark, space |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `UDB_TARGET` | Default target if none specified |
| `UDB_CONFIG_DIR` | Override `~/.udb` config directory |
| `UDB_NO_COLOR` | Disable colored output |
| `UDB_TIMEOUT` | Default timeout in milliseconds |

---

## Global Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--json` | `-j` | Output in JSON format |
| `--quiet` | `-q` | Suppress non-essential output |
| `--verbose` | `-v` | Verbose output for debugging |
| `--timeout` | `-t` | Timeout in milliseconds |

---

## Command Reference

### Discovery

```bash
udb devices [--json]
```

Lists all discoverable devices on the network.

### Device Information

```bash
udb status [target] [--json]
udb services [target] [--json]
udb info [target] [--json]
udb ping [target] [--json]
```

Query device information. `services` and `info` do not require authentication.

### Authentication

```bash
udb pair <target>
udb unpair <target> [--all | --fp <fingerprint>]
udb list-paired <target> [--json]
```

Manage device pairing.

### Execution

```bash
udb exec [target] "<command>"
udb shell [target]
```

Run commands on the device. Requires authentication.

### File Transfer

```bash
udb push [target] <local-path> <remote-path>
udb pull [target] <remote-path> <local-path>
```

Transfer files to/from the device. Requires authentication.

### Context Management

```bash
udb context list [--json]
udb context add <name> <target>
udb context use <name>
```

Manage saved device contexts.

### Fleet Management

```bash
udb group list [--json]
udb group add <name> <target> [<target>...]
udb group exec <name> "<command>"
udb inventory [--json]
```

Manage device groups.

### Diagnostics

```bash
udb doctor [target] [--json]
```

Diagnose connectivity and configuration.

### Daemon

```bash
udb daemon start
udb daemon stop
udb daemon status
```

Manage local daemon (for testing/development).

---

## Scripting Examples

### Check if device is reachable

```bash
if udb ping 10.0.0.1:9910 --json | jq -e '.success' > /dev/null; then
  echo "Device is online"
fi
```

### Run command and check exit code

```bash
udb exec 10.0.0.1:9910 "test -f /etc/config.txt"
if [ $? -eq 0 ]; then
  echo "Config file exists"
fi
```

### Get device info as JSON

```bash
udb info 10.0.0.1:9910 --json | jq '.name, .version'
```

### Fleet command with error handling

```bash
udb group exec lab "systemctl restart app" --json | jq '.[] | select(.success == false)'
```

---

## Backward Compatibility

- Exit codes are stable and will not change
- JSON structure additions are backward compatible
- New flags will not change existing behavior
- Deprecated commands will emit warnings for 2 major versions
