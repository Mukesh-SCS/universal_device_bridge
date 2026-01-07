# MCU Daemon

Lightweight UDB daemon for microcontrollers.

## Status

🔲 **Planned** - MCU daemon implementation is on the roadmap.

## Target Platforms

- **ESP32** - WiFi-enabled, sufficient resources
- **ESP8266** - Lighter weight, WiFi only
- **STM32** - ARM Cortex-M with Ethernet/WiFi
- **RP2040** - Raspberry Pi Pico (W for WiFi)

## Design Goals

1. **Minimal footprint** - Target <50KB flash, <10KB RAM
2. **No dynamic allocation** - Static buffers where possible
3. **Subset protocol** - Core operations only
4. **Multiple transports** - WiFi TCP, UART serial

## Planned Features

| Feature | Priority | Status |
|---------|----------|--------|
| TCP connection | High | 🔲 Planned |
| Authentication | High | 🔲 Planned |
| Status query | High | 🔲 Planned |
| Command exec | Medium | 🔲 Planned |
| File push/pull | Low | 🔲 Planned |
| Serial transport | Medium | 🔲 Planned |

## Implementation Language

C/C++ with platform-specific HAL:

```
udbd-mcu/
├── src/
│   ├── protocol.c     # Message parsing
│   ├── auth.c         # Crypto (Ed25519)
│   ├── handlers.c     # Message handlers
│   └── main.c         # Entry point
├── hal/
│   ├── esp32/         # ESP-IDF HAL
│   ├── stm32/         # STM32 HAL
│   └── rp2040/        # Pico SDK HAL
└── CMakeLists.txt
```

## Contributing

MCU support is a significant undertaking. If interested:

1. Start with ESP32 (most resources, WiFi built-in)
2. Implement minimal protocol subset
3. Test with existing client/CLI
4. Expand to other platforms
