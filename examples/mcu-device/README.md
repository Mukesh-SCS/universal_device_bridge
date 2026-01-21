# MCU Device Examples

This directory will contain examples for running UDB daemon on microcontrollers.

## Planned Targets

- **ESP32** - WiFi-enabled MCU
- **STM32** - ARM Cortex-M series
- **Arduino** - For compatible boards
- **RP2040** - Raspberry Pi Pico

## Status

🔲 **Planned** - MCU daemon implementation is on the roadmap.

## Architecture

MCU daemons will be lightweight implementations of the UDB protocol:

```
┌─────────────────────────────────────┐
│          MCU (e.g., ESP32)          │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐   │
│  │      udbd-mcu (C/C++)        │   │
│  │  ┌────────┐  ┌────────────┐  │   │
│  │  │ WiFi / │  │  Protocol  │  │   │
│  │  │ Serial │  │  Handler   │  │   │
│  │  └────────┘  └────────────┘  │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Contributing

If you're interested in MCU support, contributions are welcome. Key considerations:

- Minimal memory footprint
- No dynamic allocation where possible
- Support for both WiFi TCP and Serial transports
- Subset of protocol (exec, status, push/pull)
