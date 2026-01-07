# Phase 3: Advanced and Optional Features - Implementation Plan

## Executive Summary
Phase 3 transforms UDB from a CLI tool into a scriptable platform. The core work is building a reusable API layer (`@udb/client`) that both the CLI and external scripts can use. Everything else flows from that foundation.

---

## Project Status

### Phase 1-2 Baseline (Complete)
- ✅ Host-side CLI (adb-style client)
- ✅ Linux daemon
- ✅ Key-based pairing and authentication
- ✅ Core features: exec, logs, file transfer
- ✅ Protocol with file transfer messages (FILE_PUSH_*, FILE_PULL_*, FILE_ERROR)

---

## Phase 3 Execution Plan

### Step 1: Lock Phase 2 Baseline
**Status**: In Progress  
**Goal**: Ensure stability before adding Phase 3 features

**Checklist**:
- [ ] Verify CLI commands work reliably:
  - `udb devices`
  - `udb pair`
  - `udb exec`
  - `udb logs`
  - `udb push / pull`
- [ ] Run basic integration tests
- [ ] Document known limitations
- [ ] Tag release `v0.2.0`

---

### Step 2: Create @udb/client Module (CORE WORK)
**Status**: Not Started  
**Goal**: Extract CLI logic into reusable API

**Deliverables**:
1. New workspace: `client/`
2. API surface in `client/src/index.js`:

```javascript
export {
  discoverDevices,
  connect,
  pair,
  unpair,
  exec,
  logs,
  push,
  pull,
  status,
  listPaired,
  createSession,
  closeSession
}

export { UdbClient, UdbSession }
```

3. Full TypeScript types in `client/src/types.d.ts`
4. `@udb/client` in root `package.json` workspaces

**Architecture**:
- `UdbClient`: Stateless connection helper
- `UdbSession`: Persistent connection abstraction
- Protocol interactions encapsulated
- Error handling standardized
- Support for JSON output

---

### Step 3: Refactor CLI to Use @udb/client
**Status**: Not Started  
**Goal**: CLI becomes thin wrapper

**Changes**:
- `cli/src/udb.js` imports and uses `@udb/client`
- Remove duplicated connection logic
- Maintain exact same CLI interface
- Add `--json` output where missing

---

### Step 4: Advanced Scripting Features
**Status**: Not Started  
**Goal**: Add higher-level abstractions

**Deliverables**:
1. Batch execution:
   ```javascript
   await client.execBatch(["device1", "device2"], "command")
   ```

2. Session reuse:
   ```javascript
   const session = await client.createSession("target")
   await session.exec("cmd1")
   await session.exec("cmd2")
   await session.close()
   ```

3. Workflow helper (simple, no YAML):
   ```javascript
   await workflow({
     push: { local: "file", remote: "/tmp/" },
     exec: "make",
     verify: "test -f output",
     reboot: true
   })
   ```

---

### Step 5: Fleet-Level Concepts
**Status**: Not Started  
**Goal**: Logical grouping without orchestration

**Deliverables**:
1. Device grouping:
   ```bash
   udb group add lab device1 device2 device3
   udb group exec lab "command"
   ```

2. Labels and tags:
   ```bash
   udb label set device1 env=production role=gateway
   udb list --label env=production
   ```

3. Inventory output:
   ```bash
   udb inventory --json > fleet.json
   ```

---

### Step 6: Optional Cloud Augmentation
**Status**: Not Started  
**Goal**: Optional helpers without dependency

**Rules**:
- ✅ Remote discovery relay
- ✅ Fleet metadata storage
- ✅ Device status dashboard
- ❌ Requiring login for local access
- ❌ Breaking offline pairing
- ❌ Centralized command execution by default

**Implementation**:
- Separate optional package (`@udb/cloud`)
- Standalone service
- Clear local/cloud boundary

---

### Step 7: Cross-Platform GUI (Lowest Priority)
**Status**: Not Started  
**Goal**: Visual shell over existing APIs

**Rules**:
- Use existing APIs only
- Minimal feature set
- No custom protocol hacks

**Features**:
- Device list
- Pair / unpair
- Exec command
- Live logs

---

### Step 8: Hardening and Polish
**Status**: Not Started  
**Goal**: Trust and reliability

**Checklist**:
- [ ] Better error messages (actionable, not generic)
- [ ] Timeouts and retries
- [ ] Clear exit codes
- [ ] Structured logging support (JSON logs optional)
- [ ] README for each module
- [ ] API documentation with examples

---

## Immediate Next Steps

1. ✅ Understand current codebase (DONE)
2. ⏳ Review `cli/src/udb.js` to identify extractable functions
3. ⏳ Create `client/` workspace structure
4. ⏳ Build `@udb/client` API with tests
5. ⏳ Refactor CLI to use new API
6. ⏳ Add batch/session features
7. ⏳ Add fleet commands
8. ⏳ Polish and document

---

## Success Criteria

Phase 3 is complete when:
1. `@udb/client` is production-ready
2. Users can automate UDB in Node without CLI
3. Scripts and CI systems use the library
4. Fleet operations work without centralized control
5. All features work 100% offline
6. Documentation is clear and examples work

**Phase 3 Success** = "People embed UDB into their workflows without thinking about it."

