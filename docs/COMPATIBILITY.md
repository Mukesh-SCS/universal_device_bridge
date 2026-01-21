# UDB Compatibility Matrix

This document defines compatibility guarantees for UDB across versions, platforms, and Node.js runtimes.

## Version Compatibility

### Semantic Versioning

UDB follows [Semantic Versioning 2.0.0](https://semver.org/):

| Version Component | Meaning | Compatibility |
|------------------|---------|---------------|
| MAJOR (X.0.0) | Breaking changes | May require migration |
| MINOR (0.X.0) | New features | Fully backward compatible |
| PATCH (0.0.X) | Bug fixes | Fully backward compatible |

### Current Version: 0.5.0

> ⚠️ **Pre-1.0 Notice**: While in 0.x versions, minor version bumps may include breaking changes. We'll clearly document these in the changelog.

### Protocol Version: v1

The wire protocol is independently versioned:

| Protocol Version | UDB Versions | Status |
|-----------------|--------------|--------|
| v1 | 0.1.0+ | **Stable** (frozen) |

Protocol v1 is **frozen** and will not change. All UDB versions supporting v1 can communicate with each other.

## Platform Support

### Prebuilt Binaries

| Platform | Architecture | Binary | Status |
|----------|-------------|--------|--------|
| Linux | x86_64 | `udb-linux-x64` | ✅ Supported |
| Linux | ARM64 | `udb-linux-arm64` | ✅ Supported |
| macOS | Intel | `udb-macos-x64` | ✅ Supported |
| macOS | Apple Silicon | `udb-macos-arm64` | ✅ Supported |
| Windows | x86_64 | `udb-win-x64.exe` | ✅ Supported |
| Windows | ARM64 | — | ❌ Not available |

### Node.js Runtime (npm usage)

When using UDB via npm (not prebuilt binaries):

| Node.js Version | Status | Notes |
|----------------|--------|-------|
| 22.x | ✅ Current | Recommended |
| 20.x LTS | ✅ Supported | Minimum for prebuilt binaries |
| 18.x LTS | ✅ Supported | Minimum for npm install |
| 16.x | ❌ End of Life | Not supported |

### Operating System Requirements

#### Linux
- **Kernel**: 4.15+ (Ubuntu 18.04+, Debian 10+, RHEL 8+)
- **glibc**: 2.28+ (for prebuilt binaries)
- **musl**: Alpine Linux requires npm install, not prebuilt

#### macOS
- **Version**: 11.0 (Big Sur) or later
- **Rosetta 2**: Intel binaries run on Apple Silicon via Rosetta

#### Windows
- **Version**: Windows 10 1809+ or Windows Server 2019+
- **Architecture**: 64-bit only

## API Stability

### Stable APIs (Will Not Break)

These APIs have stability guarantees within major versions:

```javascript
// Device connection
import { connectDevice } from "@udb/client";
const device = await connectDevice("192.168.1.100");

// Core operations
await device.push(localPath, remotePath);
await device.pull(remotePath, localPath);
await device.exec(command);
await device.shell();
await device.listDir(path);

// Device lifecycle
await device.reboot();
device.close();
```

### Experimental APIs (May Change)

These APIs may change in minor versions:

```javascript
// Fleet operations (experimental)
import * as fleet from "@udb/client/fleet";

// Streaming exec (experimental)
device.execStream(command, { onStdout, onStderr });
```

### Internal APIs (No Guarantees)

Never rely on:
- Properties starting with `_`
- Modules under `/internal/`
- Protocol message internals

## CLI Stability

### Stable Commands

| Command | Since | Guaranteed |
|---------|-------|-----------|
| `udb devices` | 0.1.0 | ✅ |
| `udb push` | 0.1.0 | ✅ |
| `udb pull` | 0.1.0 | ✅ |
| `udb exec` | 0.1.0 | ✅ |
| `udb shell` | 0.1.0 | ✅ |
| `udb reboot` | 0.1.0 | ✅ |
| `udb pair` | 0.2.0 | ✅ |
| `udb group` | 0.3.0 | ✅ |

### Exit Codes

Stable exit code contract:

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Runtime error |
| 2 | Usage error |

See [EXIT_CODES.md](EXIT_CODES.md) for details.

### Output Format

- Human-readable by default
- `--json` flag for machine parsing (stable structure)
- Error messages may change (use exit codes for automation)

## Upgrade Policy

### Recommended Upgrade Path

1. **Always update to latest patch** within your minor version
2. **Read changelog** before minor/major updates
3. **Test in staging** before production updates

### Breaking Change Announcements

Breaking changes will be:
1. Announced in GitHub Discussions at least 2 weeks before release
2. Documented in CHANGELOG.md with migration guide
3. Tagged with `BREAKING:` in commit messages

### Deprecation Policy

1. **Deprecation warning** for 2 minor versions before removal
2. **Console warnings** when deprecated features are used
3. **Migration documentation** provided

## Long-Term Support (LTS)

### Current LTS: None (Pre-1.0)

LTS versions will be declared starting with 1.0.0.

### Planned LTS Policy

| Version | Status | Support Until |
|---------|--------|---------------|
| 1.0.x (future) | LTS | 2 years after release |

LTS versions receive:
- Security fixes
- Critical bug fixes
- No new features
- No breaking changes

## Compatibility Testing

We test compatibility via:

1. **CI Matrix**: Every PR tested against all supported Node.js versions
2. **Integration Tests**: Real device communication tests
3. **Protocol Fuzzing**: Verify protocol backward compatibility
4. **Binary Verification**: Prebuilt binaries tested on target platforms

### Test Commands

```bash
# Run full test suite
npm test

# Run compatibility tests
npm run test:compat

# Test specific Node.js version
nvm use 18 && npm test
```

## Reporting Compatibility Issues

Found a compatibility issue? Please report:

1. **Platform**: OS, version, architecture
2. **UDB Version**: `udb --version`
3. **Node.js Version**: (if applicable)
4. **Device Type**: Linux daemon, MCU, simulator
5. **Reproduction Steps**: Minimal example

Open an issue at: https://github.com/yourorg/udb/issues

## Version History

| Version | Release Date | Highlights |
|---------|-------------|------------|
| 0.5.0 | TBD | Binary distribution, compatibility docs |
| 0.4.0 | — | Streaming shell, batch operations |
| 0.3.0 | — | Fleet management, device groups |
| 0.2.0 | — | Pairing, authentication |
| 0.1.0 | — | Initial release |
