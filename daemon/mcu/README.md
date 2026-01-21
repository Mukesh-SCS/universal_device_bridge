# MCU Daemon

Lightweight UDB daemon for microcontrollers and resource-constrained devices.

## Status

✅ **Implemented** - Node.js reference implementation available.

## Available Implementations

### Node.js Reference (`udbd-mcu.js`)

A minimal Node.js implementation for testing and as a reference for native ports:

```bash
node daemon/mcu/udbd-mcu.js --name my-mcu --tcp 9910
```

Features:
- Single-connection model (one client at a time)
- Minimal memory footprint
- Built-in commands: help, info, uptime, memory, gpio, reboot
- Custom command handler support
- No external dependencies

### Native Ports (Planned)

| Platform | Status | Notes |
|----------|--------|-------|
| ESP32 | 🔲 Planned | WiFi-enabled, C/ESP-IDF |
| ESP8266 | 🔲 Planned | Lighter weight |
| STM32 | 🔲 Planned | ARM Cortex-M |
| RP2040 | 🔲 Planned | Pico W for WiFi |

## Quick Start

```bash
# Start the MCU daemon
node daemon/mcu/udbd-mcu.js --name test-mcu

# In another terminal
udb pair 127.0.0.1:9910
udb exec "info"
udb exec "uptime"
udb exec "memory"
```

## Built-in Commands

| Command | Description |
|---------|-------------|
| `help` | List available commands |
| `info` | Device information |
| `uptime` | Seconds since start |
| `memory` | Heap memory usage |
| `gpio` | GPIO status (simulated) |
| `reboot` | Reboot device (simulated) |

## Configuration

```bash
# Custom device name
node daemon/mcu/udbd-mcu.js --name my-device

# Custom port
node daemon/mcu/udbd-mcu.js --tcp 9920

# Manual pairing mode
node daemon/mcu/udbd-mcu.js --pairing manual

# Custom command handler
node daemon/mcu/udbd-mcu.js --exec ./my-handler.js
```

## Custom Command Handler

Create a JavaScript module with an `exec` function:

```javascript
// my-handler.js
export function exec(cmd) {
  if (cmd === "led on") {
    // Your custom logic here
    return { stdout: "LED turned on\n", stderr: "", code: 0 };
  }
  return null; // Fall through to built-in commands
}
```

## Design Goals

1. **Minimal footprint** - Single connection, limited buffers
2. **No external dependencies** - Pure Node.js (or native C)
3. **Subset protocol** - Core operations only
4. **Embedded-friendly** - Easy to port to C/C++

## Protocol Subset

The MCU daemon implements a minimal subset of the UDB protocol:

| Message | Supported |
|---------|-----------|
| HELLO | ✅ |
| AUTH_CHALLENGE/RESPONSE | ✅ |
| PAIR_REQUEST | ✅ |
| UNPAIR_REQUEST | ✅ |
| STATUS | ✅ |
| EXEC | ✅ |
| PUSH/PULL | 🔲 Planned |
| OPEN_SERVICE | ❌ Not supported |

## Native C Implementation (Future)

Directory structure for native ports:

```
daemon/mcu/
├── udbd-mcu.js       # Node.js reference
├── native/
│   ├── src/
│   │   ├── protocol.c     # Message parsing
│   │   ├── auth.c         # Crypto (Ed25519)
│   │   ├── handlers.c     # Message handlers
│   │   └── main.c         # Entry point
│   ├── hal/
│   │   ├── esp32/         # ESP-IDF HAL
│   │   ├── stm32/         # STM32 HAL
│   │   └── rp2040/        # Pico SDK HAL
│   └── CMakeLists.txt
└── README.md
```

## Contributing

Native ports welcome! The Node.js implementation serves as a specification.

## Contributing

MCU support is a significant undertaking. If interested:

1. Start with ESP32 (most resources, WiFi built-in)
2. Implement minimal protocol subset
3. Test with existing client/CLI
4. Expand to other platforms
