# UDB Error Taxonomy

This document defines all error classes and codes used by `@udb/client`.

## Error Class Hierarchy

```
Error
└── UdbError (base class)
    ├── AuthError
    ├── ConnectionError
    └── CommandError
```

## Error Classes

### `UdbError` ✅ Stable

Base error class for all UDB-specific errors.

```typescript
class UdbError extends Error {
  name: "UdbError";
  code: string;
  details: Record<string, unknown>;
}
```

**Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Always `"UdbError"` |
| `code` | string | Machine-readable error code |
| `message` | string | Human-readable description |
| `details` | object | Additional context (optional) |

---

### `AuthError` ✅ Stable

Thrown when authentication fails.

```typescript
class AuthError extends UdbError {
  name: "AuthError";
  code: "AUTH_FAILED";
}
```

**When Thrown:**
- Client is not paired with the device
- Pairing was rejected
- Signature verification failed
- Attempting authenticated operation without auth

**Example:**
```javascript
import { status, AuthError } from "@udb/client";

try {
  await status("192.168.1.100:9910");
} catch (err) {
  if (err instanceof AuthError) {
    console.log("Not paired - run: udb pair 192.168.1.100:9910");
  }
}
```

---

### `ConnectionError` ✅ Stable

Thrown when connection fails.

```typescript
class ConnectionError extends UdbError {
  name: "ConnectionError";
  code: "CONNECTION_FAILED";
  details: {
    host?: string;
    port?: number;
    errno?: string;
  };
}
```

**When Thrown:**
- TCP connection refused
- Serial port not found
- Connection timeout
- Network unreachable

**Example:**
```javascript
import { status, ConnectionError } from "@udb/client";

try {
  await status("192.168.1.100:9910");
} catch (err) {
  if (err instanceof ConnectionError) {
    console.log(`Cannot reach device: ${err.message}`);
    console.log(`Details: ${JSON.stringify(err.details)}`);
  }
}
```

---

### `CommandError` ✅ Stable

Thrown when a remote command fails (non-zero exit).

```typescript
class CommandError extends UdbError {
  name: "CommandError";
  code: number; // The exit code
}
```

**When Thrown:**
- `exec()` returns non-zero exit code
- Remote command not found
- Remote command permission denied

**Example:**
```javascript
import { exec, CommandError } from "@udb/client";

try {
  await exec("192.168.1.100:9910", "false"); // Always exits 1
} catch (err) {
  if (err instanceof CommandError) {
    console.log(`Command exited with code ${err.code}`);
  }
}
```

---

## Error Codes

### Connection Errors

| Code | Description |
|------|-------------|
| `CONNECTION_FAILED` | TCP/serial connection failed |
| `TIMEOUT` | Operation timed out |
| `PROTOCOL_ERROR` | Wire protocol error |

### Authentication Errors

| Code | Description |
|------|-------------|
| `AUTH_FAILED` | Authentication rejected |
| `AUTH_REQUIRED` | Operation requires authentication |
| `PAIRING_DENIED` | Device denied pairing request |

### Execution Errors

| Code | Description |
|------|-------------|
| `COMMAND_FAILED` | Remote command returned non-zero |
| `SERVICE_NOT_FOUND` | Requested service doesn't exist |
| `SERVICE_ERROR` | Service returned an error |

### Usage Errors

| Code | Description |
|------|-------------|
| `INVALID_TARGET` | Target format invalid |
| `NO_TARGET` | No target specified and none in context |
| `INVALID_ARGUMENT` | Invalid argument provided |

---

## Error Handling Patterns

### Basic Try/Catch

```javascript
import { exec, AuthError, ConnectionError, CommandError } from "@udb/client";

try {
  const result = await exec(target, command);
  console.log(result.stdout);
} catch (err) {
  if (err instanceof AuthError) {
    console.error("Not paired with device");
  } else if (err instanceof ConnectionError) {
    console.error("Cannot reach device");
  } else if (err instanceof CommandError) {
    console.error(`Command failed with exit ${err.code}`);
  } else {
    throw err; // Unexpected error
  }
}
```

### Error Code Checking

```javascript
import { exec, UdbError } from "@udb/client";

try {
  await exec(target, command);
} catch (err) {
  if (err instanceof UdbError) {
    switch (err.code) {
      case "AUTH_FAILED":
        // Handle auth
        break;
      case "CONNECTION_FAILED":
        // Handle connection
        break;
      default:
        console.error(`Error [${err.code}]: ${err.message}`);
    }
  }
}
```

### Fleet Error Handling

```javascript
import { execOnGroup } from "@udb/client/fleet";

const results = await execOnGroup("cluster", "systemctl status app");

for (const r of results) {
  if (!r.success) {
    console.error(`${r.target.host}: ${r.error.code} - ${r.error.message}`);
  }
}
```

---

## Stability Guarantee

All error classes and codes are frozen:

- Error class names will not change
- Error codes will not change
- New error codes may be added (non-breaking)
- Error messages may be improved (non-breaking)

Applications should check error codes, not message text.
