# TCP Transport

TCP transport implementation for UDB.

## Status

✅ **Implemented** - TCP is the primary transport for UDB.

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 9909 | UDP | Discovery (broadcast) |
| 9910 | TCP | Control connection |

## Usage

TCP transport is used automatically when connecting to devices via IP address:

```bash
udb pair 10.0.0.1:9910
udb exec 10.0.0.1:9910 "whoami"
```

## Implementation

The TCP transport is integrated into:

- `daemon/linux/udbd.js` - Server-side listener
- `client/src/index.js` - Client-side connection

See `transport/abstract.ts` for the transport interface.
