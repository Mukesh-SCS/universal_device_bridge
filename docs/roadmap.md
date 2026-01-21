# UDB Roadmap

Evolution of Universal Device Bridge from local-first tool to scriptable platform.

---

## v1: Initial Release (Phase 1)
✅ **COMPLETE**

- Host-side CLI (adb-style client)
- Linux daemon
- Simulator daemon
- USB and TCP transport support
- Key-based device pairing and authentication
- Core features: command execution, log streaming

---

## v2: Expansion & Hardening (Phase 2)
✅ **COMPLETE**

- MCU (Microcontroller) support
- Contexts: Save known devices locally
- Discovery fallback: Works without UDP/broadcast
- Remote targets: Explicit tcp://host:port URLs
- Enhanced error handling and diagnostics

---

## v3: Scripting & Automation (Phase 3)
✅ **COMPLETE**

### Core: Programmatic API (`@udb/client`)
- ✅ Extract CLI logic into reusable module
- ✅ Expose all operations as functions:
  - Discovery, pairing, execution
  - Status, logs, context management
  - Batch operations on multiple devices
- ✅ Type definitions included
- ✅ Full documentation and examples

### Advanced Features
- ✅ Persistent sessions (connection reuse)
- ✅ Batch execution (parallel command runs)
- ✅ Error handling (specific error types)
- ✅ Session abstraction (multiple ops per connection)

### Fleet Management
- ✅ Logical device grouping
- ✅ Device labeling and tagging
- ✅ Label-based queries (find by properties)
- ✅ Batch operations on groups
- ✅ Fleet inventory export (JSON)
- ✅ No orchestration complexity

### Examples & Documentation
- ✅ 5 example scripts with real patterns
- ✅ Complete API reference
- ✅ Error handling guide
- ✅ Best practices documentation
- ✅ CLI refactored to use API

### 100% Offline
- ✅ All features work without internet
- ✅ No cloud requirements
- ✅ No telemetry
- ✅ Suitable for air-gapped environments

---

## v4: Hardening & Extensibility (Phase 4)
✅ **COMPLETE**

### Protocol Version Negotiation
- ✅ HELLO includes protocol version (v1)
- ✅ Daemon validates and rejects unsupported versions
- ✅ Backward compatible (missing = v1)

### Service Discovery
- ✅ `udb services` - Query device capabilities
- ✅ Pre-auth access (no pairing required)
- ✅ JSON output support

### Daemon Info
- ✅ `udb info` - Query daemon metadata
- ✅ Shows version, platform, protocol, ports
- ✅ Pre-auth access

### Transport Abstraction
- ✅ Abstract Transport interface in client
- ✅ TcpTransport implementation
- ✅ Foundation for USB/Serial transports
- ✅ Exported for custom implementations

### Diagnostics
- ✅ `udb doctor` command
- ✅ Config, keys, connectivity checks
- ✅ Actionable hints for failures

### No Scope Creep
- ✅ No cloud features
- ✅ No GUI
- ✅ No orchestration
- ✅ All 79 tests pass

---

## v5: Optional Features (Future)

### Optional Cloud Augmentation (Strictly Opt-In)
- Remote discovery relay (helpers, not required)
- Fleet metadata storage (optional database)
- Device status dashboard (if interested)

**Rules:**
- Local-first always works 100%
- Cloud features never required for core operations
- Clear separation of concerns

### Cross-Platform GUI (When Stable)
- Visual device list
- Pair/unpair interface
- Command execution UI
- Live logs viewer
- Built on existing APIs (no custom hacks)

### Additional Transports
- SSH targets (for compatibility)
- Serial protocol support
- BLE/CAN if use cases emerge

---

## Design Principles (Maintained Throughout)

1. **Local-first** - All operations work offline
2. **Explicit** - No magic, clear intentions
3. **Secure** - Cryptographic by default, no exceptions
4. **Scriptable** - Both CLI and programmatic APIs
5. **Reliable** - Works consistently across platforms
6. **Simple** - No complex orchestration
7. **Composable** - Works in automation pipelines

---

## Phase 3 Success Criteria

✅ **All Met:**

- `@udb/client` is production-ready
- Users can automate UDB in Node without CLI
- Scripts and CI systems use the library
- Fleet operations work without centralized control
- All features work 100% offline
- Documentation is clear and examples work
- **People embed UDB into their workflows without thinking about it**

---

## Current Status

**Phase 3: Complete ✅**

- Programmatic API: Ready
- Fleet management: Ready
- Documentation: Complete
- Examples: 5 working scripts
- CLI refactored: Ready
- Ready for real-world use

---

## Installation & Quick Start

```bash
npm install @udb/client
node scripts/devices.js
```

See [README.md](../README.md) and [API Reference](../client/API.md) for details.

---

## Contributing

UDB is designed to be extended at the edges:

- New transport layers (add to `transport/` folder)
- New daemon features (extend `daemon/` logic)
- New client operations (add to `@udb/client`)
- New scripts (add to `scripts/` examples)

Core protocol changes require careful consideration.

---

## Known Limitations & Future Work

- MCU support not yet tested extensively
- File transfer via push/pull commands (implemented ✅)
- No persistent logging by default
- No automatic retry/reconnect (by design)
- No role-based access control (by design)
- No scheduling/orchestration (by design)

These are intentional to keep UDB simple and composable.

---

For detailed Phase 3 plan and implementation, see [PHASE3_PLAN.md](PHASE3_PLAN.md).