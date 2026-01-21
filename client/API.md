# @udb/client API Reference

Complete reference for the Universal Device Bridge programmatic API.

## Table of Contents

1. [Discovery & Connection](#discovery--connection)
2. [Core Operations](#core-operations)
3. [Context Management](#context-management)
4. [Sessions](#sessions)
5. [Batch Operations](#batch-operations)
6. [Fleet Management](#fleet-management)
7. [Error Handling](#error-handling)
8. [Configuration](#configuration)

---

## Discovery & Connection

### `discoverDevices(timeoutMs?)`

Discover devices on the local network via UDP broadcast.

```javascript
import { discoverDevices } from "@udb/client";

const devices = await discoverDevices();
// [
//   { host: "192.168.1.100", port: 9910, name: "lab-device-1" },
//   { host: "192.168.1.101", port: 9910, name: "lab-device-2" }
// ]
```

**Parameters:**
- `timeoutMs` (number, optional): Timeout in milliseconds. Default: `1200`

**Returns:** `Promise<Array<DiscoveredDevice>>`

**Throws:** Nothing (empty array if no devices found)

---

### `parseTarget(arg)`

Parse a target string into `{ host, port }` format.

```javascript
import { parseTarget } from "@udb/client";

const t1 = parseTarget("192.168.1.100:9910");
// { host: "192.168.1.100", port: 9910 }

const t2 = parseTarget("tcp://192.168.1.100:9910");
// { host: "192.168.1.100", port: 9910 }
```

**Parameters:**
- `arg` (string): Target in format `ip:port` or `tcp://host:port`

**Returns:** `{ host: string, port: number }`

**Throws:** `UdbError` if format is invalid

---

### `resolveTarget(maybeTarget?)`

Resolve a target from explicit argument, current context, last target, or discovery.

```javascript
import { resolveTarget } from "@udb/client";

// Explicit target
const t1 = await resolveTarget("192.168.1.100:9910");

// From current context (no args)
const t2 = await resolveTarget();

// From named context
const t3 = await resolveTarget("lab"); // Would need context management
```

**Parameters:**
- `maybeTarget` (string | object, optional): Explicit target

**Returns:** `Promise<Target>`

**Resolution order:**
1. Explicit target (if provided)
2. Current context
3. Last used target
4. Discovery (best-effort)

**Throws:** `UdbError` if no target found or ambiguous

---

### `probeTcp(target, timeoutMs?)`

Test TCP connectivity to a target.

```javascript
import { probeTcp } from "@udb/client";

const reachable = await probeTcp({ host: "192.168.1.100", port: 9910 });
console.log(reachable); // true or false
```

**Parameters:**
- `target` (object): `{ host: string, port: number }`
- `timeoutMs` (number, optional): Timeout in milliseconds. Default: `400`

**Returns:** `Promise<boolean>`

**Throws:** Nothing (returns false on timeout/error)

---

## Core Operations

### `status(target)`

Get device status.

```javascript
import { status } from "@udb/client";

const info = await status("192.168.1.100:9910");
// {
//   name: "device-name",
//   pairingMode: "auto",
//   execEnabled: true,
//   pairedCount: 3
// }
```

**Parameters:**
- `target` (string | object): Device target

**Returns:** `Promise<StatusResult>`

**Throws:** `AuthError`, `ConnectionError`, `UdbError`

---

### `pair(target)`

Pair with a device (authorize this client).

```javascript
import { pair } from "@udb/client";

const result = await pair("192.168.1.100:9910");
// { fingerprint: "abc123...", paired: true }
```

**Parameters:**
- `target` (string | object): Device target

**Returns:** `Promise<PairResult>`

**Throws:** `AuthError` (if pairing denied), `ConnectionError`, `UdbError`

---

### `unpair(target, options?)`

Unpair from a device.

```javascript
import { unpair } from "@udb/client";

// Unpair specific client
const r1 = await unpair("192.168.1.100:9910", {
  fingerprint: "abc123..."
});

// Unpair all clients
const r2 = await unpair("192.168.1.100:9910", { all: true });
// { scope: "all", removed: 5, fingerprint: undefined }
```

**Parameters:**
- `target` (string | object): Device target
- `options` (object, optional):
  - `all` (boolean): Remove all paired clients
  - `fingerprint` (string): Remove specific client by fingerprint

**Returns:** `Promise<UnpairResult>`

**Throws:** `AuthError` (if not authorized), `UdbError`

---

### `listPaired(target)`

List all paired clients on a device.

```javascript
import { listPaired } from "@udb/client";

const clients = await listPaired("192.168.1.100:9910");
// [
//   { fp: "abc123...", name: "cli-host", addedAt: "2026-01-07T..." },
//   { fp: "def456...", name: "script-runner", addedAt: "2026-01-07T..." }
// ]
```

**Parameters:**
- `target` (string | object): Device target

**Returns:** `Promise<Array<PairedClient>>`

**Throws:** `AuthError`, `UdbError`

---

### `exec(target, command)`

Execute a command on a device.

```javascript
import { exec } from "@udb/client";

const result = await exec("192.168.1.100:9910", "whoami");
// { stdout: "user\n", stderr: "", exitCode: 0 }
```

**Parameters:**
- `target` (string | object): Device target
- `command` (string): Shell command to execute

**Returns:** `Promise<ExecResult>`

**Throws:** `CommandError` (if exit code != 0), `AuthError`, `UdbError`

---

## Context Management

### `getContexts()`

Get all configured contexts.

```javascript
import { getContexts } from "@udb/client";

const contexts = getContexts();
// {
//   "lab": { host: "192.168.1.100", port: 9910, name: "lab-device" },
//   "prod": { host: "10.0.0.100", port: 9910, name: "prod-device" }
// }
```

**Returns:** `object` (contexts map)

---

### `getCurrentContextName()`

Get the name of the currently active context.

```javascript
import { getCurrentContextName } from "@udb/client";

const name = getCurrentContextName();
// "lab"
```

**Returns:** `string | null`

---

### `setCurrentContext(name)`

Set the active context.

```javascript
import { setCurrentContext } from "@udb/client";

setCurrentContext("lab");
```

**Parameters:**
- `name` (string): Context name

**Throws:** `UdbError` if context doesn't exist

---

### `addContext(name, target)`

Add a new context.

```javascript
import { addContext } from "@udb/client";

addContext("lab", {
  host: "192.168.1.100",
  port: 9910,
  name: "lab-device"  // optional
});
```

**Parameters:**
- `name` (string): Context name
- `target` (object): `{ host: string, port: number, name?: string }`

---

### `getContext(name)`

Get a specific context.

```javascript
import { getContext } from "@udb/client";

const ctx = getContext("lab");
// { host: "192.168.1.100", port: 9910, name: "lab-device" }
```

**Parameters:**
- `name` (string): Context name

**Returns:** `object | null`

---

### `removeContext(name)`

Remove a context.

```javascript
import { removeContext } from "@udb/client";

removeContext("lab");
```

**Parameters:**
- `name` (string): Context name

---

## Sessions

### `createSession(target)`

Create a persistent session for multiple operations.

```javascript
import { createSession } from "@udb/client";

const session = await createSession("192.168.1.100:9910");

try {
  const info = await session.status();
  const r1 = await session.exec("whoami");
  const r2 = await session.exec("pwd");
} finally {
  await session.close();
}
```

**Parameters:**
- `target` (string | object): Device target

**Returns:** `Promise<UdbSession>`

---

### `UdbSession` Class

Represents a persistent connection to a device.

#### Methods

##### `connect()`

Connect and authenticate (automatically called by `createSession`).

```javascript
const session = new UdbSession(target);
await session.connect();
```

**Returns:** `Promise<void>`

**Throws:** `ConnectionError`, `AuthError`

---

##### `exec(command)`

Execute a command in the session.

```javascript
const result = await session.exec("ls /tmp");
// { stdout: "...", stderr: "", exitCode: 0 }
```

**Returns:** `Promise<ExecResult>`

**Throws:** `CommandError`, `UdbError`

---

##### `status()`

Get device status in the session.

```javascript
const info = await session.status();
// { name: "device", pairingMode: "auto", ... }
```

**Returns:** `Promise<StatusResult>`

**Throws:** `UdbError`

---

##### `close()`

Close the session.

```javascript
await session.close();
```

**Returns:** `Promise<void>`

---

## Batch Operations

### `execBatch(targets, command, options?)`

Execute the same command on multiple devices.

```javascript
import { execBatch } from "@udb/client";

const targets = [
  "192.168.1.100:9910",
  "192.168.1.101:9910",
  "192.168.1.102:9910"
];

const results = await execBatch(targets, "uname -a", { parallel: true });
// [
//   { target: {...}, success: true, result: {...} },
//   { target: {...}, success: true, result: {...} },
//   { target: {...}, success: false, error: Error }
// ]
```

**Parameters:**
- `targets` (Array<string | object>): Array of device targets
- `command` (string): Command to execute
- `options` (object, optional):
  - `parallel` (boolean): Run in parallel. Default: `true`
  - `stopOnError` (boolean): Stop on first error. Default: `false`

**Returns:** `Promise<Array<BatchResult>>`

---

## Fleet Management

Fleet management is in a separate module:

```javascript
import {
  createGroup,
  getGroup,
  listGroups,
  execOnGroup,
  setLabels,
  getLabels,
  findByLabels,
  exportInventory
} from "@udb/client/fleet";
```

### `createGroup(groupName, targets)`

Create a logical group of devices.

```javascript
createGroup("lab", [
  { host: "192.168.1.100", port: 9910 },
  { host: "192.168.1.101", port: 9910 }
]);
```

**Parameters:**
- `groupName` (string): Group name
- `targets` (Array<object>): Array of targets

**Returns:** `{ group: string, deviceCount: number }`

---

### `getGroup(groupName)`

Get devices in a group.

```javascript
const devices = getGroup("lab");
// [{ host: "192.168.1.100", port: 9910 }, ...]
```

**Returns:** `Array<Target>`

---

### `listGroups()`

List all groups.

```javascript
const groups = listGroups();
// [
//   { name: "lab", deviceCount: 2, devices: [...] },
//   { name: "prod", deviceCount: 5, devices: [...] }
// ]
```

**Returns:** `Array<GroupInfo>`

---

### `execOnGroup(groupName, command, options?)`

Execute command on all devices in a group.

```javascript
const results = await execOnGroup("lab", "whoami", { parallel: true });
```

**Parameters:**
- `groupName` (string): Group name
- `command` (string): Command to execute
- `options` (object, optional): Same as `execBatch`

**Returns:** `Promise<Array<BatchResult>>`

---

### `setLabels(target, labels)`

Set labels on a device.

```javascript
setLabels(
  { host: "192.168.1.100", port: 9910 },
  { env: "production", role: "gateway" }
);
```

**Parameters:**
- `target` (object): Device target
- `labels` (object): Labels to set

---

### `getLabels(target)`

Get labels for a device.

```javascript
const labels = getLabels({ host: "192.168.1.100", port: 9910 });
// { env: "production", role: "gateway" }
```

**Returns:** `object` (labels)

---

### `findByLabels(query)`

Find devices matching label query.

```javascript
const devices = findByLabels({ env: "production" });
// [
//   { host: "192.168.1.100", port: 9910, labels: {...} },
//   { host: "192.168.1.101", port: 9910, labels: {...} }
// ]
```

**Parameters:**
- `query` (object): Label query (all must match)

**Returns:** `Array<Device>`

---

### `exportInventory()`

Export fleet inventory as JSON.

```javascript
const inventory = exportInventory();
// {
//   timestamp: "2026-01-07T...",
//   groups: {...},
//   devices: [...]
// }
```

**Returns:** `object` (inventory)

---

## Error Handling

### Error Types

#### `UdbError`

Base error class. All UDB errors inherit from this.

```javascript
try {
  await exec(target, "command");
} catch (err) {
  if (err instanceof UdbError) {
    console.log(err.code);     // Error code string
    console.log(err.message);  // Human-readable message
    console.log(err.details);  // Additional info
  }
}
```

**Properties:**
- `code` (string): Error code (e.g., "AUTH_FAILED", "CONNECTION_FAILED")
- `message` (string): Human-readable error message
- `details` (object): Additional error details

---

#### `AuthError`

Authentication or authorization failed.

```javascript
catch (err) {
  if (err instanceof AuthError) {
    // Device not paired or auth failed
    // Solution: Run pair() command
  }
}
```

---

#### `ConnectionError`

Network or connection issue.

```javascript
catch (err) {
  if (err instanceof ConnectionError) {
    // Network unreachable, device offline, etc.
    // Check: Is device online? Is firewall blocking?
  }
}
```

---

#### `CommandError`

Command execution failed with non-zero exit code.

```javascript
catch (err) {
  if (err instanceof CommandError) {
    console.log(err.code); // Exit code (e.g., 1, 127)
    // stdout/stderr available in result
  }
}
```

---

## Configuration

### `getConfig()`

Get full configuration object.

```javascript
import { getConfig } from "@udb/client";

const cfg = getConfig();
// {
//   lastTarget: { host: "...", port: 9910 },
//   currentContext: "lab",
//   contexts: {...}
// }
```

**Returns:** `Config` object

---

### `setConfig(cfg)`

Set full configuration object.

```javascript
import { setConfig } from "@udb/client";

setConfig({
  lastTarget: { host: "192.168.1.100", port: 9910 },
  currentContext: "lab",
  contexts: { lab: {...} }
});
```

**Parameters:**
- `cfg` (object): Configuration object

---

## Best Practices

### 1. Use Sessions for Multiple Operations

**Good:**
```javascript
const session = await createSession(target);
await session.exec("cmd1");
await session.exec("cmd2");
await session.close();
```

**Bad:**
```javascript
await exec(target, "cmd1");  // New connection
await exec(target, "cmd2");  // New connection
```

### 2. Use Batch Execution for Multiple Devices

**Good:**
```javascript
const results = await execBatch(devices, "whoami", { parallel: true });
```

**Bad:**
```javascript
for (const d of devices) {
  await exec(d, "whoami");  // Sequential, slower
}
```

### 3. Handle Errors Appropriately

**Good:**
```javascript
try {
  await exec(target, "command");
} catch (err) {
  if (err instanceof AuthError) {
    console.log("Not paired, run pair()");
  } else if (err instanceof ConnectionError) {
    console.log("Device offline");
  }
}
```

**Bad:**
```javascript
await exec(target, "command").catch(err => {
  console.log("Error:", err);  // Not specific enough
});
```

### 4. Use Contexts for Known Devices

**Good:**
```javascript
addContext("production", { host: "10.0.0.100", port: 9910 });
const target = await resolveTarget();  // Uses current context
```

**Bad:**
```javascript
await exec("10.0.0.100:9910", "command");
await exec("10.0.0.100:9910", "command");  // Repeating
```

### 5. Use Groups for Fleet Operations

**Good:**
```javascript
createGroup("lab", labDevices);
const results = await execOnGroup("lab", "whoami");
```

**Bad:**
```javascript
// Executing on many devices individually
```

---

## Timeouts

All operations have reasonable defaults:
- Discovery: 1200ms
- TCP probe: 400ms
- Command execution: 10000ms (10s)
- Session operations: 10000ms (10s)

To customize, see individual function documentation.

---

## 100% Offline

All operations work completely offline:
- No cloud connection required
- No internet required
- No telemetry
- No external dependencies

---

## Support

For questions or issues, refer to:
- Main UDB documentation
- Examples in `scripts/` folder
- GitHub issues

