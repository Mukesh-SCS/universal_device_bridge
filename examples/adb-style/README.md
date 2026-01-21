# udb-Style UDB Examples

UDB works like Android's udb but for any device. These examples show common workflows.

## Quick Start

```bash
# Install UDB
curl -fsSL https://get.udb.dev | sh

# Discover devices
udb devices

# Connect and use
udb connect 10.0.0.1:9910
udb shell
```

## Examples

1. [Embedded Linux](embedded-linux.md) - Raspberry Pi, BeagleBone, etc.
2. [MCU over Serial](mcu-serial.md) - ESP32, Arduino, STM32
3. [CI Simulator](ci-simulator.md) - Automated testing

## udb Command Mapping

| udb | UDB | Notes |
|-----|-----|-------|
| `udb devices` | `udb devices` | Lists all devices |
| `udb connect <ip>` | `udb connect <ip>:9910` | Connects to device |
| `udb shell` | `udb shell` | Opens interactive shell |
| `udb push <src> <dst>` | `udb push <src> <dst>` | Pushes file |
| `udb pull <src> <dst>` | `udb pull <src> <dst>` | Pulls file |
| `udb start-server` | `udb start-server` | Starts daemon |
| `udb kill-server` | `udb kill-server` | Stops daemon |
