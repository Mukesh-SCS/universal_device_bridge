# UDB v4 Features

This directory contains optional v4 features that extend UDB beyond its core local-first functionality.

## Design Principle

> **Local-first always works 100%. Cloud/GUI features are strictly optional.**

All v4 features follow these rules:
1. Core UDB works completely offline
2. No cloud features are required for any operation
3. Clear separation between local and optional features
4. Opt-in only, never opt-out

## Available Extensions

### Cloud (Optional)

Optional cloud services for enhanced fleet management:

- **Discovery Relay** - Help find devices across networks
- **Fleet Registry** - Optional device metadata storage
- **Status Dashboard** - Web-based device monitoring

See [cloud/README.md](./cloud/README.md)

### GUI (Optional)

Graphical interface for UDB:

- **Device Browser** - Visual device list
- **Command Runner** - Execute commands with UI
- **Log Viewer** - Live log streaming
- **Fleet Dashboard** - Group management

See [gui/README.md](./gui/README.md)

### Additional Transports

Extended transport support:

- **Bluetooth LE** - For BLE-enabled devices
- **CAN Bus** - Automotive/industrial
- **WebSocket** - Browser-based access

See [transports/README.md](./transports/README.md)

## Status

| Feature | Status | Notes |
|---------|--------|-------|
| Cloud Discovery Relay | 🔲 Planned | Optional helper |
| Cloud Fleet Registry | 🔲 Planned | Optional storage |
| Cloud Dashboard | 🔲 Planned | Web UI |
| Desktop GUI | 🔲 Planned | Electron app |
| BLE Transport | 🔲 Planned | Bluetooth LE |
| CAN Transport | 🔲 Planned | Automotive |
| WebSocket Transport | 🔲 Planned | Browser access |

## Getting Started

None of these features are required. Use only what you need:

```bash
# Core UDB works without any v4 features
udb devices
udb exec "hostname"

# Optionally enable cloud relay
udb config set cloud.relay https://your-relay.example.com

# Optionally start GUI
udb gui
```
