# Simulator Examples

This directory contains examples for using the UDB simulator daemon for testing.

## Purpose

The simulator daemon (`udbd-sim.js`) allows testing UDB workflows without physical hardware. It provides a **fully simulated environment** with:

- Mock command execution (returns realistic simulated output)
- Virtual filesystem for push/pull operations
- Simulated interactive shell
- Configurable latency for testing timeouts
- Full authentication and pairing support

## Quick Start

```bash
# Start simulator
node daemon/simulator/udbd-sim.js --name test-device

# In another terminal
udb devices
udb pair 127.0.0.1:9910
udb exec "whoami"        # Returns: simulator
udb exec "hostname"      # Returns: test-device
udb exec "uname -a"      # Returns simulated Linux kernel info
```

## Supported Commands

The simulator provides realistic output for common commands:

| Command | Simulated Output |
|---------|-----------------|
| `whoami` | `simulator` |
| `hostname` | Device name |
| `uname -a` | Simulated Linux kernel info |
| `id` | Simulated user info |
| `uptime` | Simulated uptime |
| `ps` | Simulated process list |
| `ls`, `ls -la` | Simulated directory listing |
| `df -h` | Simulated disk usage |
| `free -m` | Simulated memory info |
| `echo <text>` | Echoes the text |
| `cat <file>` | Reads from virtual filesystem |
| `true` | Exit code 0 |
| `false` | Exit code 1 |
| `exit <n>` | Exit with code n |

## Virtual Filesystem

The simulator includes a virtual filesystem:

- `/etc/hostname` - Device name
- `/etc/os-release` - Simulated OS info
- `/proc/uptime` - Simulated uptime
- `/tmp/test.txt` - Test file

Files pushed via `udb push` are stored in the virtual filesystem and persisted.

## Use Cases

1. **Development** - Test client code without devices
2. **CI/CD** - Automated testing in pipelines  
3. **Documentation** - Generate screenshots and examples
4. **Learning** - Understand UDB without hardware
5. **Latency Testing** - Use `--latency` to test timeout handling

## Configuration

```bash
# Custom port
node daemon/simulator/udbd-sim.js --tcp 9920 --udp 9919

# Custom device name
node daemon/simulator/udbd-sim.js --name my-sim-device

# Auto-pair mode (default)
node daemon/simulator/udbd-sim.js --pairing auto

# Manual pair mode (for testing pairing flow)
node daemon/simulator/udbd-sim.js --pairing prompt

# Simulate network latency (100ms delay)
node daemon/simulator/udbd-sim.js --latency 100

# Verbose logging
node daemon/simulator/udbd-sim.js --verbose
```

## State Directory

Simulator state is stored in `~/.udbd-sim/`:
- `authorized_keys.json` - Paired clients
- `files/` - Pushed files
