# UDB Scripts Examples

Collection of real-world examples showing how to use the `@udb/client` API programmatically.

## Prerequisites

All scripts require:
1. A running UDB daemon on a target device
2. Node.js with `@udb/client` installed

## Examples

### 01-discover.js
Basic device discovery and status checking.

```bash
node scripts/01-discover.js
```

Shows:
- How to discover devices on the network
- How to get device status
- Error handling for unreachable devices

### 02-batch-exec.js
Execute the same command on multiple devices in parallel.

```bash
node scripts/02-batch-exec.js
```

Shows:
- How to run batch operations efficiently
- Parallel vs sequential execution
- Aggregating results from multiple devices

### 03-session.js
Use persistent sessions for multiple operations.

```bash
node scripts/03-session.js <target>
```

Example:
```bash
node scripts/03-session.js 192.168.1.100:9910
```

Shows:
- Creating and managing sessions
- Reusing connections for efficiency
- Executing multiple commands in one session

### 04-contexts.js
Context-based device management.

```bash
node scripts/04-contexts.js
```

Shows:
- Creating named contexts for devices
- Using contexts for easy device selection
- Resolving targets from contexts

### 05-error-handling.js
Proper error handling patterns.

```bash
node scripts/05-error-handling.js <target>
```

Example:
```bash
node scripts/05-error-handling.js 192.168.1.100:9910
```

Shows:
- Catching specific error types (AuthError, ConnectionError, CommandError)
- Handling auth failures
- Handling command failures
- Graceful degradation

## Writing Your Own Script

Basic template:

```javascript
import { discoverDevices, exec, status } from "@udb/client";

async function main() {
  const devices = await discoverDevices();
  
  for (const device of devices) {
    const info = await status(device);
    console.log(`${device.name}: ${info.pairingMode}`);
  }
}

main().catch(console.error);
```

## API Reference

See `@udb/client` README for full API documentation.

### Core Functions

- `discoverDevices(timeoutMs)` - Discover devices via UDP
- `status(target)` - Get device status
- `exec(target, command)` - Execute command
- `pair(target)` - Pair with device
- `unpair(target, options)` - Unpair from device
- `createSession(target)` - Create persistent connection

### Context Functions

- `getContexts()` - Get all contexts
- `addContext(name, target)` - Add named context
- `setCurrentContext(name)` - Set active context
- `resolveTarget(maybeTarget)` - Resolve from explicit, context, or discovery

### Error Types

- `UdbError` - Base error
- `AuthError` - Authentication/authorization failed
- `ConnectionError` - Network/connection issue
- `CommandError` - Command execution failed

## Tips

1. **Use sessions for multiple operations**: Avoids reconnecting
2. **Use batch execution**: Runs commands in parallel on multiple devices
3. **Use contexts**: Easy management of known devices
4. **Handle errors properly**: Different error types need different actions
5. **100% offline**: No internet required, all operations are local

## Testing

Run all examples with a device to see them in action:

```bash
# Terminal 1: Start the daemon
node daemon/linux/udbd.js --pairing auto

# Terminal 2: Run examples
node scripts/01-discover.js
node scripts/02-batch-exec.js
node scripts/03-session.js 127.0.0.1:9910
node scripts/04-contexts.js
```

---

For questions or issues, see the main UDB documentation.
