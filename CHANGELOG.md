# Changelog

All notable changes to UDB are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.5.0] - 2026-01-21

### Added

#### Phase 6: Ecosystem & Real-World Adoption

- **CLI UX Polish** (Phase 6A)
  - Every command now supports `--json` and `-j` flags
  - Standardized exit codes: 0 (success), 1 (error), 2 (usage)
  - Errors print to stderr, JSON to stdout
  - Improved help text with descriptions
  - CLI contract documentation (`docs/CLI_CONTRACT.md`)

- **CI & Automation Readiness** (Phase 6B)
  - Headless smoke test (`ci/smoke-test.js`)
  - 10-step integration test covering full workflow
  - Docker image for CI (`Dockerfile`)
  - Exit code documentation (`docs/EXIT_CODES.md`)

- **SDK Stabilization** (Phase 6C)
  - API stability markers (✅ Stable, 🔶 Beta, ⚠️ Internal)
  - Comprehensive TypeScript types (`types.d.ts`)
  - Error taxonomy documentation (`docs/ERRORS.md`)
  - No `any` types in public APIs

- **GitHub Actions Integration** (Phase 6D)
  - Reference workflow (`examples/github-actions/`)
  - Deployment script example
  - Fleet deployment patterns
  - Complete CI/CD documentation

### Changed

- `die()` function replaced with `handleError()` for proper JSON output
- Usage errors now return exit code 2 instead of 1
- Help text now shows version number (v0.5.0)

---

## [0.4.0] - 2026-01-21

### Added

#### Phase 4: Hardening & Extensibility

- **Protocol Version Negotiation**
  - HELLO message now includes `protocol` field
  - Daemon validates protocol version, rejects unsupported versions
  - Backward compatible: missing protocol treated as v1

- **Service Discovery**
  - New `services` service (pre-auth)
  - Lists device capabilities and available services
  - `getServices(target)` API function
  - `udb services [ip:port]` CLI command

- **Device Info Service**
  - New `info` service (pre-auth)
  - Returns daemon metadata (version, platform, etc.)
  - `getInfo(target)` API function
  - `udb info [ip:port]` CLI command

- **Transport Abstraction**
  - Abstract `Transport` base class
  - `TcpTransport` implementation
  - Foundation for future USB/Serial transports
  - Exported for custom transport implementations

- **Diagnostics**
  - `udb doctor [ip:port]` command
  - 7-point diagnostic with actionable hints

#### Phase 5: Stability & Expansion

- **Serial Transport** (Phase 5A)
  - `SerialTransport` implementing Transport interface
  - `createSerialTransport()` factory function
  - `parseSerialTarget()` for serial:// URLs
  - Serial daemon for embedded devices
  - Same protocol over different wire - validates architecture

- **Multi-Stream Concurrency** (Phase 5B)
  - Validated concurrent stream handling
  - Independent stream routing
  - Early close doesn't affect other streams
  - `scripts/multi_stream.js` example

- **Daemon Lifecycle Services** (Phase 5C)
  - `ping` service (pre-auth, health check)
  - `shutdown` service (auth required)
  - `restart` service (auth required)
  - `ping(target)` API function
  - `udb ping [ip:port]` CLI command

- **Protocol Documentation** (Phase 5D)
  - PROTOCOL.md with full wire format specification
  - Protocol v1 declared stable
  - Backward compatibility rules documented

### Fixed

- Stream.write() now properly base64 encodes all data types

### Changed

- Daemon version bumped to 0.4.0
- Services list now includes ping/shutdown/restart capabilities

## [0.3.0] - 2026-01-20

### Added

#### Phase 3: Scripting & Automation

- **Programmatic API (`@udb/client`)**
  - All CLI operations exposed as functions
  - Type definitions included
  - Full documentation and examples

- **Session Abstraction**
  - `createSession()` for persistent connections
  - `UdbSession` class with exec, status, openService
  - Stream abstraction for bidirectional communication

- **Fleet Management**
  - Device grouping with `createGroup()`, `addToGroup()`
  - Device labeling with `setLabels()`, `getLabels()`
  - Label-based queries with `findByLabels()`
  - Batch operations with `execBatch()`
  - Inventory export with `exportInventory()`

- **Context Management**
  - Save known devices with `addContext()`
  - Switch targets with `setCurrentContext()`
  - Automatic target resolution

- **Error Handling**
  - `UdbError`, `AuthError`, `ConnectionError`, `CommandError`
  - Specific error codes for programmatic handling

## [0.2.0] - 2026-01-19

### Added

#### Phase 2: Expansion & Hardening

- MCU (Microcontroller) support
- Contexts: Save known devices locally
- Discovery fallback: Works without UDP/broadcast
- Remote targets: Explicit tcp://host:port URLs
- Enhanced error handling and diagnostics

## [0.1.0] - 2026-01-18

### Added

#### Phase 1: Initial Release

- Host-side CLI (adb-style client)
- Linux daemon
- Simulator daemon
- USB and TCP transport support
- Key-based device pairing and authentication
- Core features: command execution, log streaming
- File push/pull
- Interactive shell

---

## Upgrade Guide

### From 0.3.x to 0.4.0

No breaking changes. All existing code continues to work.

New features available:
- Use `udb services` and `udb info` for device discovery
- Use `udb ping` for quick health checks
- Use `udb doctor` for troubleshooting
- Transport layer now supports custom implementations

### Protocol Compatibility

- Protocol v1 is stable and frozen
- All future changes will be backward compatible
- New protocol versions will be negotiated, never forced
