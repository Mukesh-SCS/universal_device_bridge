# UDB Testing Guide

## Prerequisites

- Node.js installed
- Two terminals available

---

## Step 1: Start the Daemon

**Terminal 1:**
```bash
udb daemon start
```

Or manually:
```bash
node daemon/linux/udbd.js --pairing auto
```

Expected output:
```
UDBD listening TCP on :9910
UDP discovery listening on :9909
```

---

## Step 2: Discover Devices

**Terminal 2:**
```bash
udb devices
```

Expected output:
```
test-device (127.0.0.1:9910)  [online]
```

If UDP is blocked:
```bash
udb status 127.0.0.1:9910
```

**Fallback Test (using explicit target):**
```bash
node cli/src/udb.js status 127.0.0.1:9910
---

## Step 3: Pair with Device

```bash
udb pair 127.0.0.1:9910
```

Expected output:
```
Paired with test-device
Fingerprint: abc123...
```

---

## Step 4: Execute Commands

```bash
udb exec 127.0.0.1:9910 "whoami"
```

Expected output:
```
root
```

---

## Step 5: Test Contexts

```bash
# Add a context
udb context add lab 127.0.0.1:9910

# List contexts
udb context list

# Use the context
udb context use lab

# Now commands use the context automatically
udb exec "hostname"
udb status --json
```

---

## Step 6: Test Programmatic API

Create `test-api.js`:
```javascript
import { exec, discoverDevices, status } from "@udb/client";

async function test() {
  console.log("1. Discovering...");
  const devices = await discoverDevices();
  console.log(`Found: ${devices.length} device(s)`);
  
  if (devices.length > 0) {
    const device = devices[0];
    console.log("\n2. Status:");
    const info = await status(device);
    console.log(info);
    
    console.log("\n3. Executing...");
    const result = await exec(device, "whoami");
    console.log(result.stdout);
  }
}

test().catch(console.error);
```

Run:
```bash
node test-api.js
```

---

## Step 7: Test Batch Execution

```javascript
import { execBatch } from "@udb/client";

async function test() {
  const targets = [
    { host: "127.0.0.1", port: 9910 }
  ];
  
  const results = await execBatch(targets, "whoami", { parallel: true });
  results.forEach((r, i) => {
    console.log(`Target ${i}: ${r.success ? "✓" : "✗"}`);
    if (r.success) console.log(`  ${r.result.stdout}`);
    if (r.error) console.log(`  Error: ${r.error.message}`);
  });
}

test().catch(console.error);
```

---

## Step 8: Test Example Scripts

```bash
# Device discovery
node scripts/devices.js

# Batch execution
node scripts/exec.js

# Session usage
node scripts/context.js 127.0.0.1:9910

# Pairing workflow
node scripts/pair.js

# Fleet operations
node scripts/group.js
```

---

## Step 9: Test Fleet Operations

```bash
# Create a group
udb group add lab 127.0.0.1:9910

# Execute on group
udb group exec lab "whoami"

# List groups
udb group list

# Export inventory
udb inventory --json
```

---

## Step 10: Daemon Management

```bash
# Stop the daemon
udb daemon stop

# Check status
udb daemon status

# Start again
udb daemon start
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "No devices found" | UDP might be blocked, try: `udb status 127.0.0.1:9910` |
| "Not authorized" | Device not paired, run: `udb pair 127.0.0.1:9910` |
| "Cannot connect" | Check daemon is running: `udb daemon status` |
| Port in use | Use different port: `node daemon/linux/udbd.js --tcp 9911` |
| Command timeout | Device is slow or command hanging |

---

## Success Checklist

- [ ] Daemon starts with `udb daemon start`
- [ ] `udb devices` discovers daemon
- [ ] `udb pair` works without errors
- [ ] `udb exec "whoami"` returns output
- [ ] Contexts can be saved with `udb context add`
- [ ] Contexts work with `udb context use`
- [ ] Groups can be created with `udb group add`
- [ ] Groups can execute with `udb group exec`
- [ ] Example scripts run without errors
- [ ] API works with programmatic test

All checks passed = **System is working correctly ✅**