# MCU over Serial (ESP32, Arduino, STM32)

## Setup

1. Flash UDB firmware to MCU (see `daemon/mcu/`)
2. Connect via USB

## Usage

```bash
# List devices (includes serial)
udb devices

# Connect to serial device
udb connect serial:///dev/ttyUSB0

# Or on Windows
udb connect serial://COM3

# Run command
udb exec "reboot"

# Push firmware
udb push ./firmware.bin /flash/app.bin
```

## Output

```
$ udb devices
NAME             TYPE              TARGET                   STATUS
esp32-01         mcu               serial:///dev/ttyUSB0    online

$ udb exec "version"
UDB-MCU v1.0.0 (ESP32)
```

## Notes

- Default baud rate: 115200
- Custom baud: `serial:///dev/ttyUSB0?baud=921600`
- MCU commands depend on firmware implementation
