# @udb/client

Programmatic API for Universal Device Bridge. Use this module to automate UDB operations in Node.js scripts, CI systems, or applications without using the CLI.

## Installation

```bash
npm install @udb/client
```

## Quick Start

```javascript
import { discoverDevices, connect, exec } from "@udb/client";

// Discover devices on the network
const devices = await discoverDevices();
console.log(devices); // [{ host: "192.168.1.100", port: 9910, name: "device1", ... }]

// Connect to a device
const client = await connect("192.168.1.100:9910");

// Execute a command
const result = await exec(client, "whoami");
console.log(result.stdout); // "user\n"
```

## API Reference

### Discovery & Connection

- `discoverDevices(timeoutMs)` - Discover devices via UDP broadcast
- `connect(target, options)` - Connect to a device, returns connection object
- `closeConnection(conn)` - Close a connection

### Core Operations

- `pair(conn)` - Pair with a device
- `unpair(conn, options)` - Unpair from a device
- `exec(conn, command)` - Execute a command on device
- `status(conn)` - Get device status
- `logs(conn, options)` - Stream device logs
- `push(conn, local, remote)` - Push file to device
- `pull(conn, remote, local)` - Pull file from device
- `listPaired(conn)` - List paired clients on device

### Sessions

- `createSession(target, options)` - Create a persistent session
- `UdbSession.exec(command)` - Execute in session
- `UdbSession.push(local, remote)` - Push in session
- `UdbSession.close()` - Close session

### Advanced

- `execBatch(targets, command, options)` - Run command on multiple devices
- `createWorkflow(steps)` - Define a multi-step workflow

## Examples

See `examples/` folder for real-world usage patterns.

## Error Handling

All API functions throw descriptive errors:

```javascript
try {
  await exec(conn, "false");
} catch (err) {
  console.error(err.message); // "Command failed with exit code 1"
  console.error(err.code); // 1
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
