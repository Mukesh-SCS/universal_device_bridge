# USB Transport

USB transport implementation for UDB.

## Status

🔲 **Planned** - USB transport is on the roadmap.

## Purpose

USB transport will enable direct device connections without network:

- Direct USB cable connection
- USB serial (CDC/ACM) devices
- USB accessory mode

## Use Cases

- Devices without network connectivity
- Secure environments (air-gapped)
- Initial device setup before network config
- MCU/embedded devices with USB

## Planned Implementation

```
┌─────────────┐     USB     ┌─────────────┐
│   Client    │◀───────────▶│   Device    │
│  (Host PC)  │   Serial    │   (udbd)    │
└─────────────┘             └─────────────┘
```

## Interface

Will implement `AbstractTransport` from `transport/abstract.ts`:

```typescript
class UsbTransport extends AbstractTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(data: Uint8Array): Promise<void>;
  onReceive(callback: (data: Uint8Array) => void): void;
}
```

## Contributing

If you need USB support, contributions are welcome. Consider:

- Cross-platform USB access (libusb, node-usb)
- Serial port abstraction
- Device enumeration and auto-detection
