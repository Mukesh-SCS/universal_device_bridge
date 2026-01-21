# UDB Exit Codes

This document defines the exit codes for all UDB CLI commands.

## Standard Exit Codes

| Code | Name | Description |
|------|------|-------------|
| `0` | `SUCCESS` | Operation completed successfully |
| `1` | `ERROR` | General error (connection, auth, runtime) |
| `2` | `USAGE` | Invalid arguments or usage error |

## Command-Specific Exit Codes

### `udb exec`

The `exec` command propagates the remote command's exit code:

| Code | Description |
|------|-------------|
| `0` | Remote command succeeded |
| `1-125` | Remote command's exit code |
| `126` | Command not executable |
| `127` | Command not found |
| `128+N` | Command killed by signal N |

### `udb shell`

| Code | Description |
|------|-------------|
| `0` | Shell session ended normally |
| `1` | Connection or auth error |

### `udb doctor`

| Code | Description |
|------|-------------|
| `0` | Doctor completed (regardless of findings) |
| `2` | Invalid arguments |

## Error Categories

### Exit Code 1 - General Errors

These errors result in exit code 1:

| Error Code | Description |
|------------|-------------|
| `CONNECTION_FAILED` | TCP/serial connection failed |
| `AUTH_FAILED` | Not paired, authentication rejected |
| `COMMAND_FAILED` | Remote command returned non-zero |
| `SERVICE_NOT_FOUND` | Requested service doesn't exist |
| `TIMEOUT` | Operation timed out |
| `PROTOCOL_ERROR` | Wire protocol error |

### Exit Code 2 - Usage Errors

These errors result in exit code 2:

| Error Code | Description |
|------------|-------------|
| `USAGE_ERROR` | Invalid command syntax |
| `INVALID_TARGET` | Target format invalid |
| `NO_TARGET` | No target specified and none in context |
| `FILE_NOT_FOUND` | Local file not found (push) |

## CI Integration

### Checking for Success

```bash
udb ping 192.168.1.100:9910
if [ $? -eq 0 ]; then
  echo "Device is online"
fi
```

### Distinguishing Error Types

```bash
udb exec 192.168.1.100:9910 "my-command"
code=$?

case $code in
  0) echo "Success" ;;
  1) echo "Connection or auth error" ;;
  2) echo "Usage error" ;;
  *) echo "Command exited with $code" ;;
esac
```

### JSON Error Handling

```bash
result=$(udb info 192.168.1.100:9910 --json 2>&1)
if echo "$result" | jq -e '.success == false' > /dev/null 2>&1; then
  error_code=$(echo "$result" | jq -r '.error.code')
  error_msg=$(echo "$result" | jq -r '.error.message')
  echo "Error [$error_code]: $error_msg"
fi
```

## GitHub Actions Example

```yaml
- name: Check device connectivity
  run: |
    udb ping ${{ env.DEVICE_TARGET }}
  continue-on-error: false

- name: Deploy application
  run: |
    udb exec ${{ env.DEVICE_TARGET }} "systemctl restart myapp"
  continue-on-error: false
```

## Stability Guarantee

Exit codes are stable and will not change in future versions:
- Code 0 always means success
- Code 1 always means runtime error
- Code 2 always means usage error
- `udb exec` always propagates remote exit codes
