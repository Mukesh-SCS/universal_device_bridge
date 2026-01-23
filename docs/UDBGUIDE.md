# UDB Testing Guide (TESTING.md)

This document defines the **mandatory manual test procedure** for Universal Device Bridge (UDB).

Follow this exactly. Skipping steps invalidates the test.

---

## Scope

This guide validates:

* Cross-device connectivity
* Pairing and authentication persistence
* Command execution correctness
* Streaming shell stability
* File transfer integrity
* Context reliability
* Failure handling

Target audience: maintainers and contributors before tagging a release.

---

## Test Setup

### Devices

* **Laptop A**: Device (runs `udbd`)
* **Laptop B**: Client (runs `udb` CLI)

### Requirements

* Same local network
* Node.js installed on both machines
* Ports `9909` (UDP) and `9910` (TCP) allowed through firewall
* Fresh terminals (no prior raw-mode sessions)

---

## Phase 1: Baseline Sanity

Run on **both laptops**:

```bash
udb --version
node --version
```

Expected:

* `udb` is resolvable from PATH
* Node versions are compatible (note any major mismatch)

---

## Phase 2: Daemon Validation (Laptop A)

### Start daemon cleanly

```bash
udb daemon stop
udb daemon start
udb daemon status
```

Expected:

* Daemon reports running
* No errors in stdout or `~/.udbd/udbd.log`

### Verify ports

```bash
netstat -an | grep 9910
netstat -an | grep 9909
```

Expected:

* Both ports are listening

---

## Phase 3: Discovery (Laptop B → Laptop A)

```bash
udb devices
```

Expected:

* Laptop A listed
* Correct hostname
* Marked `[online]`

If discovery fails:

```bash
udb status <LaptopA_IP>:9910
```

Expected:

* Status returns successfully

Note: TCP working without UDP is acceptable.

---

## Phase 4: Pairing

```bash
udb pair <LaptopA_IP>:9910
```

Expected:

* `Paired OK fp=...`

Verify pairing:

```bash
udb list-paired <LaptopA_IP>:9910
```

Expected:

* Client fingerprint listed

Failure here indicates broken auth persistence.

---

## Phase 5: Stateless Command Execution

```bash
udb exec <LaptopA_IP>:9910 "whoami"
udb exec <LaptopA_IP>:9910 "pwd"
```

Expected:

* Correct user
* Valid working directory
* Exit code 0

### Forced failure

```bash
udb exec <LaptopA_IP>:9910 "false"
```

Expected:

* Non-zero exit code
* CLI exits with same code

---

## Phase 6: Streaming Shell

```bash
udb shell <LaptopA_IP>:9910
```

Inside shell:

```bash
ls
echo hello
exit
```

Resize terminal during session.

Expected:

* No garbled output
* No stuck raw mode
* Terminal restored after exit

If terminal breaks, shell cleanup is incorrect.

---

## Phase 7: File Transfer Integrity

```bash
echo "UDB TEST $(date)" > test.txt
udb push <LaptopA_IP>:9910 test.txt /test/test.txt
udb pull <LaptopA_IP>:9910 /test/test.txt pulled.txt
diff test.txt pulled.txt
```

Expected:

* No diff
* Correct byte counts reported

### Path traversal protection

```bash
udb push <LaptopA_IP>:9910 test.txt ../../evil.txt
```

Expected:

* Explicit failure

If this succeeds, it is a critical security bug.

---

## Phase 8: Context Management

```bash
udb context add lab <LaptopA_IP>:9910
udb context use lab
udb exec "hostname"
```

Expected:

* No IP specified
* Correct device targeted

Restart terminal and repeat to confirm persistence.

---

## Phase 9: Reboot Resilience

1. Reboot **Laptop A**
2. Start daemon again
3. On Laptop B:

```bash
udb exec "whoami"
```

Expected:

* Command works without re-pairing

If re-pairing is required, auth storage is broken.

---

## Phase 10: Negative Tests

* Stop daemon → run `udb exec` → clean error
* Kill network mid-shell → CLI exits cleanly
* Run two shells in parallel → both work or fail cleanly

Hangs or silent failures are not acceptable.

---

## Test Completion Criteria

Before release:

* All phases pass
* All failures documented with:

  * Exact command
  * Expected behavior
  * Actual behavior

If any phase fails, **do not tag a release**.

---

## Philosophy

UDB’s value is reliability.


