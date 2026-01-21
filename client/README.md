# @udb/client

Programmatic API for Universal Device Bridge. Use this module to automate UDB operations in Node.js scripts, CI systems, or applications without using the CLI.

## Installation

```bash
npm install @udb/client
```

## Quick Start

```javascript
import { discoverDevices, exec, status, createSession } from "@udb/client";

// Discover devices on the network
const devices = await discoverDevices();
console.log(devices); // [{ host: "192.168.1.100", port: 9910, name: "device1" }]

// Execute a command (one-shot, auto-connects)
const result = await exec("192.168.1.100:9910", "whoami");
console.log(result.stdout); // "user\n"

// Or use a session for multiple operations
const session = await createSession("192.168.1.100:9910");
const r1 = await session.exec("hostname");
const r2 = await session.exec("uptime");
await session.close();
```

## API Reference

### Discovery & Target Resolution

- `discoverDevices(timeoutMs)` - Discover devices via UDP broadcast
- `parseTarget(arg)` - Parse "ip:port" or "tcp://host:port" string
- `resolveTarget(maybeTarget)` - Resolve target from arg, context, or discovery
- `probeTcp(target, timeoutMs)` - Test TCP connectivity

### Core Operations (One-Shot)

- `pair(target)` - Pair with a device
- `unpair(target, options)` - Unpair from a device
- `exec(target, command)` - Execute a command on device
- `status(target)` - Get device status
- `push(target, localPath, remotePath)` - Push file to device
- `pull(target, remotePath, localPath)` - Pull file from device
- `listPaired(target)` - List paired clients on device

### Sessions (Persistent Connection)

- `createSession(target)` - Create a persistent session
- `createStreamingSession(target)` - Alias for createSession (streaming support)
- `UdbSession.exec(command)` - Execute command in session
- `UdbSession.status()` - Get status in session
- `UdbSession.openService(name, options)` - Open streaming service (e.g., shell)
- `UdbSession.close()` - Close session

### Context Management

- `getContexts()` - Get all saved contexts
- `getCurrentContextName()` - Get current context name
- `setCurrentContext(name)` - Switch to a context
- `addContext(name, target)` - Save a new context
- `getContext(name)` - Get context by name
- `removeContext(name)` - Remove a context

### Batch Operations

- `execBatch(targets, command, options)` - Run command on multiple devices

## Fleet Management

Import fleet functions separately:

```javascript
import { createGroup, execOnGroup, findByLabels } from "@udb/client/fleet";

// Create a device group
createGroup("lab", [
  { host: "192.168.1.100", port: 9910 },
  { host: "192.168.1.101", port: 9910 }
]);

// Execute on entire group
const results = await execOnGroup("lab", "hostname");

// Label devices and query by label
setLabels({ host: "192.168.1.100", port: 9910 }, { env: "prod", role: "web" });
const prodDevices = findByLabels({ env: "prod" });
```

## Examples

See `examples/` folder for real-world usage patterns.

## Error Handling

All API functions throw descriptive errors:

```javascript
import { exec, AuthError, ConnectionError, CommandError } from "@udb/client";

try {
  await exec("192.168.1.100:9910", "false");
} catch (err) {
  if (err instanceof AuthError) {
    console.error("Not paired - run: udb pair <target>");
  } else if (err instanceof ConnectionError) {
    console.error("Cannot reach device:", err.message);
  } else if (err instanceof CommandError) {
    console.error("Command failed with exit code:", err.code);
  }
}
```

## Configuration

Store persistent config in `~/.udb/config.json`:

```json
{
  "lastTarget": { "host": "192.168.1.100", "port": 9910 },
  "contexts": {
    "lab": { "host": "192.168.1.100", "port": 9910, "name": "lab-device" }
  }
}
```

## 100% Offline

All @udb/client operations work without internet or cloud services. No telemetry, no cloud requirements.

---

For full API documentation, see [API.md](./API.md).
