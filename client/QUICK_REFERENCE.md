# @udb/client - Quick Reference Guide

Fast lookup for common operations. For full documentation, see [API.md](./API.md).

---

## Installation

```bash
npm install @udb/client
```

---

## Import Examples

```javascript
// Core operations
import { exec, status, pair, unpair } from "@udb/client";

// Discovery
import { discoverDevices, resolveTarget } from "@udb/client";

// Sessions
import { createSession } from "@udb/client";

// Batch
import { execBatch } from "@udb/client";

// Context
import { setCurrentContext, addContext } from "@udb/client";

// Fleet (separate module)
import { createGroup, execOnGroup } from "@udb/client/fleet";

// Errors
import { UdbError, AuthError, CommandError } from "@udb/client";
```

---

## Most Common Patterns

### Execute a Command
```javascript
const result = await exec("192.168.1.100:9910", "whoami");
console.log(result.stdout); // "user\n"
```

### Get Device Status
```javascript
const info = await status("192.168.1.100:9910");
console.log(info.name); // "device-name"
```

### Discover Devices
```javascript
const devices = await discoverDevices();
devices.forEach(d => console.log(d.name));
```

### Create a Session (Multiple Commands)
```javascript
const session = await createSession("192.168.1.100:9910");
await session.exec("cd /tmp");
await session.exec("ls");
await session.close();
```

### Batch Execute Across Multiple Devices
```javascript
const results = await execBatch(devices, "whoami");
results.forEach(r => {
  if (r.success) console.log(r.result.stdout);
  else console.error(r.error.message);
});
```

### Pair with Device
```javascript
const result = await pair("192.168.1.100:9910");
console.log(result.fingerprint); // "abc123..."
```

---

## Context Quick Reference

### Add Context
```javascript
import { addContext, getContexts } from "@udb/client";
addContext("lab", { host: "192.168.1.100", port: 9910 });
```

### Use Context (Resolve Without Args)
```javascript
import { setCurrentContext, resolveTarget } from "@udb/client";
setCurrentContext("lab");
const target = await resolveTarget(); // Uses "lab" context
await exec(target, "whoami");
```

### List Contexts
```javascript
import { getContexts } from "@udb/client";
const all = getContexts();
```

---

## Fleet Management Quick Reference

```javascript
import {
  createGroup,
  getGroup,
  execOnGroup,
  setLabels,
  findByLabels,
  exportInventory
} from "@udb/client/fleet";

// Create group
createGroup("lab", [
  { host: "192.168.1.100", port: 9910 },
  { host: "192.168.1.101", port: 9910 }
]);

// Execute on group
const results = await execOnGroup("lab", "uptime");

// Label devices
setLabels({ host: "192.168.1.100", port: 9910 }, {
  env: "prod",
  role: "gateway"
});

// Find by label
const devices = findByLabels({ env: "prod" });

// Export
const inventory = exportInventory();
```

---

## Error Handling

```javascript
import {
  exec,
  AuthError,
  ConnectionError,
  CommandError,
  UdbError
} from "@udb/client";

try {
  const result = await exec(target, "command");
} catch (err) {
  if (err instanceof AuthError) {
    console.log("Device not paired");
  } else if (err instanceof ConnectionError) {
    console.log("Network error");
  } else if (err instanceof CommandError) {
    console.log(`Command failed with code ${err.code}`);
  } else {
    console.log(`Unknown error: ${err.message}`);
  }
}
```

---

## Target Formats

All functions accept targets in multiple formats:

```javascript
// String format
await exec("192.168.1.100:9910", "whoami");
await exec("tcp://192.168.1.100:9910", "whoami");

// Object format
await exec({ host: "192.168.1.100", port: 9910 }, "whoami");

// String context name (after setting it)
await exec("lab", "whoami");
```

---

## Return Type Examples

### ExecResult
```javascript
{
  stdout: "user\n",
  stderr: "",
  exitCode: 0
}
```

### StatusResult
```javascript
{
  name: "device-name",
  pairingMode: "auto",
  execEnabled: true,
  pairedCount: 3
}
```

### BatchResult
```javascript
[
  {
    target: { host: "...", port: 9910 },
    success: true,
    result: { stdout: "...", ... }
  },
  {
    target: { host: "...", port: 9910 },
    success: false,
    error: Error("Connection failed")
  }
]
```

---

## Performance Tips

### ✅ Use Sessions for Multiple Operations
```javascript
// Good - One connection, multiple commands
const session = await createSession(target);
await session.exec("cmd1");
await session.exec("cmd2");
await session.close();

// Avoid - New connection per command
await exec(target, "cmd1");
await exec(target, "cmd2");
```

### ✅ Use Batch Execution for Multiple Devices
```javascript
// Good - Parallel execution
const results = await execBatch(devices, "whoami", { parallel: true });

// Avoid - Sequential execution
for (const d of devices) await exec(d, "whoami");
```

### ✅ Use Contexts for Repeated Access
```javascript
// Good - One setup, reuse many times
addContext("prod", target);
setCurrentContext("prod");
const t = await resolveTarget();
// Use t many times

// Avoid - Typing target repeatedly
await exec("192.168.1.100:9910", "cmd1");
await exec("192.168.1.100:9910", "cmd2");
```

---

## Timeout Handling

All operations have defaults, customizable via options:

```javascript
// Discovery timeout
await discoverDevices(2000); // 2 seconds

// All TCP operations default to 10 seconds
```

---

## Configuration Persistence

```javascript
import { getConfig, setConfig } from "@udb/client";

// Read current config
const cfg = getConfig();

// Modify config
cfg.lastTarget = { host: "...", port: 9910 };

// Write back
setConfig(cfg);
```

---

## CLI Equivalents

Compare CLI with API:

| Operation | CLI | API |
|-----------|-----|-----|
| Discover | `udb devices` | `await discoverDevices()` |
| Status | `udb status` | `await status(target)` |
| Execute | `udb exec "cmd"` | `await exec(target, "cmd")` |
| Pair | `udb pair` | `await pair(target)` |
| Batch | `udb group exec` | `await execOnGroup(group, cmd)` |

---

## Real-World Examples

### CI/CD Deployment
```javascript
import { execBatch } from "@udb/client";
const devices = JSON.parse(process.env.TARGETS);
const results = await execBatch(devices, "docker pull && docker start");
```

### Device Health Check
```javascript
import { discoverDevices, status } from "@udb/client";
const devices = await discoverDevices();
for (const d of devices) {
  try {
    const s = await status(d);
    console.log(`${d.name}: ${s.pairingMode}`);
  } catch (e) {
    console.log(`${d.name}: OFFLINE`);
  }
}
```

### Fleet Labeling
```javascript
import { createGroup, setLabels } from "@udb/client/fleet";
createGroup("gateways", gatewayDevices);
gatewayDevices.forEach(d => 
  setLabels(d, { role: "gateway", env: "prod" })
);
```

---

## Debugging

### Enable Error Details
```javascript
try {
  await exec(target, "cmd");
} catch (err) {
  console.log(err.code);     // Error code string
  console.log(err.message);  // Human message
  console.log(err.details);  // Additional info (if available)
}
```

### Verify Target Reachability
```javascript
import { probeTcp } from "@udb/client";
const online = await probeTcp({ host: "192.168.1.100", port: 9910 });
```

### Parse Target Strings
```javascript
import { parseTarget } from "@udb/client";
const t1 = parseTarget("192.168.1.100:9910");
const t2 = parseTarget("tcp://example.com:9910");
```

---

## Common Gotchas

### ❌ Forgetting `await`
```javascript
// Wrong - Promise not awaited
exec(target, "whoami");

// Right
await exec(target, "whoami");
```

### ❌ Not Closing Sessions
```javascript
// Wrong - Resource leak
const s = await createSession(target);
await s.exec("cmd");
// Forgot await s.close()

// Right
const s = await createSession(target);
try {
  await s.exec("cmd");
} finally {
  await s.close();
}
```

### ❌ Ignoring Command Errors
```javascript
// Wrong - Command exit code not checked
const r = await exec(target, "false"); // exit 1

// Right - CommandError thrown
try {
  await exec(target, "false");
} catch (err) {
  if (err instanceof CommandError) {
    console.log(`Exit code: ${err.code}`);
  }
}
```

---

## Full Documentation

For complete reference, see [API.md](./API.md)

For working examples, see [scripts/README.md](../scripts/README.md)

---

**Last Updated:** Phase 3 Complete  
**Status:** Production Ready  
**License:** Apache-2.0
