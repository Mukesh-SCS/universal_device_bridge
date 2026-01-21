# UDB Streaming Shell Implementation

## Overview
This document describes the implementation of streaming shell support in UDB, following the ADB mental model (Device → Service → Stream).

## Architecture

### 1. Protocol Layer (`protocol/src/messages.js`)
Added 5 new message types to support streaming services:

- `OPEN_SERVICE` - Client requests to open a named service on device
- `STREAM_DATA` - Bidirectional data transmission (base64 encoded)
- `STREAM_CLOSE` - Stream closure notification
- `STREAM_RESIZE` - Terminal resize event (for PTY services)
- `SERVICE_ERROR` - Service-level errors

### 2. Daemon Layer (`daemon/linux/udbd.js`)

#### Stream Management
- `openStreams` Map: Tracks active streams by streamId
- `generateStreamId()`: Creates unique stream IDs for multiplexing

#### OPEN_SERVICE Handler
- Routes requests by service name (e.g., "shell")
- For shell service:
  - Spawns interactive PTY with `node-pty`
  - Configures: xterm-color terminal, 80x24 size, current working directory
  - Forwards PTY output → STREAM_DATA messages to client
  - Handles PTY exit → STREAM_CLOSE message

#### STREAM_DATA Handler
- Routes client input to PTY stdin
- Enables: live typing, arrow keys, tab completion, shell history

#### STREAM_RESIZE Handler
- Propagates terminal resize events to PTY
- Enables responsive shell behavior

### 3. Client Layer (`client/src/index.js`)

#### Stream Class
Event-emitting abstraction for bidirectional streams:
- `write(data)` - Send data to device
- `resize(cols, rows)` - Resize terminal
- `close()` - Close stream
- `on(event, callback)` - Listen for: 'data', 'close', 'error'

#### UdbSession Enhancement
- `openStreams` Map: Tracks active streams
- Message router: Routes STREAM_* messages by streamId
- `openService(name, options)` - Opens named service, returns Stream

#### createStreamingSession Function
Alias for `createSession()` emphasizing streaming capability

### 4. CLI Layer (`cli/src/udb.js`)

#### shellCmd Function
Implements interactive shell:
- Resolves target device
- Opens streaming session
- Requests "shell" service with PTY options (cols, rows)
- Sets terminal to raw mode for real-time I/O
- Forwards stdin ↔ shell ↔ stdout
- Handles terminal resize events
- Manages terminal state restoration on exit

## Data Flow

```
User Terminal Input
    ↓
process.stdin (raw mode)
    ↓
shellCmd() writes to stream
    ↓
Client sends STREAM_DATA(streamId, data)
    ↓
TCP connection
    ↓
Daemon receives STREAM_DATA
    ↓
Routes to PTY stdin by streamId
    ↓
Shell process (sh/bash)
    ↓
Output captured by PTY
    ↓
Daemon sends STREAM_DATA(streamId, output)
    ↓
TCP connection
    ↓
Client routes to Stream by streamId
    ↓
Stream emits 'data' event
    ↓
shellCmd() writes to process.stdout
    ↓
Terminal displays output
```

## Dependencies

### Daemon
- `node-pty` v1.0.0 - Pseudo-terminal spawning and management

### Protocol
- No new dependencies (uses existing message framing)

### Client
- No new dependencies (uses existing session infrastructure)

### CLI
- No new dependencies (uses Node.js built-in modules)

## Testing Checklist

- [ ] Daemon starts without errors
- [ ] Client can open streaming session
- [ ] `udb shell` starts interactive shell
- [ ] Typing appears correctly in real-time
- [ ] Tab completion works
- [ ] Arrow keys navigate history
- [ ] Ctrl+C stops running commands (doesn't kill daemon)
- [ ] Ctrl+D exits shell cleanly
- [ ] Terminal resize (SIGWINCH) propagates correctly
- [ ] Multiple concurrent shells work (stream multiplexing)
- [ ] Errors are handled gracefully

## Next Steps

1. ✅ Protocol streaming messages added
2. ✅ Daemon PTY implementation complete
3. ✅ Client streaming API complete
4. ✅ CLI shell command ready
5. 🔲 End-to-end testing
6. 🔲 Add additional services (exec, logs, fs)
7. 🔲 Optimize performance/stability
8. 🔲 Add signal forwarding (Ctrl+C propagation)

## Code Locations

| Component | File | Key Functions/Classes |
|-----------|------|---------------------|
| Protocol | `protocol/src/messages.js` | MSG constants (OPEN_SERVICE, STREAM_DATA, etc.) |
| Daemon | `daemon/linux/udbd.js` | openStreams, generateStreamId(), OPEN_SERVICE handler |
| Client | `client/src/index.js` | Stream class, UdbSession.openService(), createStreamingSession() |
| CLI | `cli/src/udb.js` | shellCmd() |

## Streaming Service Pattern

All future services (exec, logs, fs, etc.) will follow this pattern:

```javascript
// Open service
const stream = await session.openService(serviceName, options);

// Listen for data
stream.on('data', (data) => {
  console.log(data.toString());
});

// Handle close
stream.on('close', () => {
  console.log('Service finished');
});

// Send data if needed
stream.write('some input');

// Close stream
stream.close();
```

This is the foundational pattern for all streaming operations in UDB.
