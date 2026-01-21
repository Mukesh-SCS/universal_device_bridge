# USB Transport

USB transport implementation for UDB.

## Status

✅ **Implemented** - USB serial transport is available.

## Installation

The USB transport requires the `serialport` package:

```bash
npm install serialport
```

## Purpose

USB transport enables direct device connections without network:

- Direct USB cable connection
- USB serial (CDC/ACM) devices
- USB-UART bridges (FTDI, CP210x, CH340, etc.)
- MCU/embedded devices with USB

## Use Cases

- Devices without network connectivity
- Secure environments (air-gapped)
- Initial device setup before network config
- MCU/embedded devices with USB

## Quick Start

```javascript
import { UsbTransport, UsbTransportFactory } from "./usb-transport.js";

// List available USB serial ports
const ports = await UsbTransport.listPorts();
console.log(ports);

// Find UDB-compatible devices
const devices = await UsbTransport.findUdbDevices();
console.log(devices);

// Connect by port path
const transport = UsbTransportFactory.byPath("/dev/ttyUSB0");
await transport.connect();

// Or auto-detect
const autoTransport = await UsbTransportFactory.autoDetect();
if (autoTransport) {
  await autoTransport.connect();
}
```

## Supported Devices

The transport auto-detects common USB-serial adapters:

| Chip | Vendor ID | Description |
|------|-----------|-------------|
| FTDI FT232 | 0403 | Classic USB-UART |
| CP210x | 10C4 | Silicon Labs |
| CH340 | 1A86 | WinChipHead |
| PL2303 | 067B | Prolific |
| Arduino | 2341 | Arduino boards |
| ESP32 | 303A | Espressif |
| STM32 | 0483 | STMicroelectronics |

## Configuration

```javascript
const transport = new UsbTransport({
  path: "/dev/ttyUSB0",    // Serial port path
  baudRate: 115200,         // Baud rate (default: 115200)
  dataBits: 8,              // Data bits (default: 8)
  stopBits: 1,              // Stop bits (default: 1)
  parity: "none"            // Parity (default: none)
});
```

## API

### UsbTransport

```javascript
// Static methods
UsbTransport.listPorts()      // List all serial ports
UsbTransport.findUdbDevices() // Find compatible devices

// Instance methods
transport.connect()           // Connect to device
transport.disconnect()        // Disconnect
transport.send(data)          // Send data
transport.onReceive(callback) // Register receive handler
transport.isConnected()       // Check connection state
transport.getState()          // Get detailed state
```

### UsbTransportFactory

```javascript
UsbTransportFactory.byPath(path, options)              // By port path
UsbTransportFactory.byVendorProduct(vid, pid, options) // By USB IDs
UsbTransportFactory.autoDetect(options)                // Auto-detect
```

## Frame Format

Uses same length-prefixed format as TCP transport:

```
┌─────────────────────────────────────────┐
│  4 bytes (BE)  │  N bytes              │
│  Payload Len   │  JSON Payload (UTF-8) │
└─────────────────────────────────────────┘
```

## Platform Notes

### Linux
- May need udev rules for non-root access
- Ports appear as `/dev/ttyUSB*` or `/dev/ttyACM*`

### macOS
- Ports appear as `/dev/cu.usbserial-*` or `/dev/cu.usbmodem*`

### Windows
- Ports appear as `COM1`, `COM2`, etc.
- May need driver installation for some adapters
- Serial port abstraction
- Device enumeration and auto-detection
