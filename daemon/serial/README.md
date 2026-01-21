# Serial Transport

Serial port transport for UDB - enables communication with embedded devices and MCUs over serial/UART.

## Overview

The serial transport uses the exact same protocol as TCP, proving that UDB's transport abstraction works correctly. No protocol changes were required.

## Installation

The serial transport requires the `serialport` npm package:

```bash
npm install serialport
```

## Usage

### Client Side

```javascript
import { createSerialTransport, tcpRequest } from "@udb/client";

// Create a serial transport
const transport = createSerialTransport("COM3", {
  baudRate: 115200,
  timeout: 10000
});

// Use with tcpRequest (name is misleading, works with any transport)
const result = await tcpRequest(null, messages, { transport });
```

### URL Format

Serial targets can be specified as URLs:

```
serial://COM3
serial:///dev/ttyUSB0
serial://COM3?baud=9600
```

### Daemon Side

Run the serial daemon on the device:

```bash
# Basic usage
node serial-daemon.js --port /dev/ttyUSB0

# With options
node serial-daemon.js --port COM3 --baud 115200 --name my-device --verbose
```

## Virtual Serial Ports for Testing

### Windows

Use [com0com](https://sourceforge.net/projects/com0com/) to create virtual serial port pairs.

```
# Install com0com
# Creates COM10 <-> COM11 pair by default
```

### Linux

Use `socat` to create virtual serial port pairs:

```bash
# Create pair
socat -d -d pty,raw,echo=0 pty,raw,echo=0

# Output will show paths like:
# /dev/pts/2 <-> /dev/pts/3
```

### macOS

Use `socat` (install via Homebrew):

```bash
brew install socat
socat -d -d pty,raw,echo=0 pty,raw,echo=0
```

## Supported Operations

All standard UDB operations work over serial:

- ✅ `services` - Query device capabilities
- ✅ `info` - Query device metadata
- ✅ `ping` - Health check
- ✅ `pair` - Pairing flow
- ✅ `exec` - Command execution
- ✅ `status` - Device status

## Architecture Validation

The serial transport validates UDB's design:

1. **No protocol changes** - Exact same message format as TCP
2. **No framing changes** - Same length-prefixed JSON frames
3. **No client changes** - `tcpRequest` works with any Transport
4. **Transport independence** - Adding USB/BLE would follow the same pattern

## Example: Embedded Device

```javascript
import { createSerialTransport, exec } from "@udb/client";

const transport = createSerialTransport("/dev/ttyUSB0");

// Execute command on embedded device
const result = await exec("gpio read 17", { transport });
console.log(result.stdout);
```

## Troubleshooting

### Port Access Denied (Linux)

Add user to dialout group:

```bash
sudo usermod -a -G dialout $USER
# Log out and back in
```

### Port Busy

Check for other processes using the port:

```bash
lsof /dev/ttyUSB0
```

### No Data Received

1. Check baud rate matches between client and device
2. Verify TX/RX wiring is correct (may need crossover)
3. Check flow control settings
