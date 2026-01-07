# Simulator Examples

This directory contains examples for using the UDB simulator daemon for testing.

## Purpose

The simulator daemon (`udbd-sim.js`) allows testing UDB workflows without physical hardware. It simulates a device that can:

- Accept connections and authentication
- Execute commands (returns simulated output)
- Handle file push/pull operations
- Respond to status queries

## Quick Start

```bash
# Start simulator
node daemon/simulator/udbd-sim.js --name test-device

# In another terminal
udb devices
udb pair 127.0.0.1:9910
udb exec "echo hello"
```

## Use Cases

1. **Development** - Test client code without devices
2. **CI/CD** - Automated testing in pipelines
3. **Documentation** - Generate screenshots and examples
4. **Learning** - Understand UDB without hardware

## Configuration

```bash
# Custom port
node daemon/simulator/udbd-sim.js --tcp 9920 --udp 9919

# Custom device name
node daemon/simulator/udbd-sim.js --name my-sim-device

# Auto-pair mode
node daemon/simulator/udbd-sim.js --pairing auto
```

## Limitations

- Commands return simulated output, not real execution
- File operations work but files are stored in temp directory
- No actual system access
