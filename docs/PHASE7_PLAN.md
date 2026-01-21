# Phase 7 Implementation Plan

**Goal:** Make UDB something teams can install, upgrade, and depend on for years without fear.

**Status:** 🚧 IN PROGRESS

Phase 6 proved usability and CI fitness.
Phase 7 proves operational maturity.

---

## Phase 7A — Installation & Distribution ✅

### Why This Is Highest Priority
Adoption still assumes Node, repo cloning, or Docker. Unacceptable for operators.

### Deliverables

#### Prebuilt CLI Binaries
- [x] Build configuration for `pkg`
- [x] Linux x64 + arm64
- [x] macOS Intel + Apple Silicon
- [x] Windows x64
- [x] Single `udb` executable

#### One-Command Installer
- [x] Linux/macOS: `curl | sh` installer
- [x] Windows: PowerShell installer
- [x] Installs binary + adds to PATH

#### Release Artifacts
- [x] GitHub Actions release workflow
- [x] Checksums (SHA256)
- [x] Upgrade notes template

### Definition of Done
A user installs UDB without knowing it's written in Node.

---

## Phase 7B — Compatibility & Upgrade Policy

### Deliverables

#### Compatibility Matrix
- [ ] CLI ↔ daemon version compatibility
- [ ] Client library ↔ daemon guarantees
- [ ] Protocol version mapping

#### Upgrade Rules
- [ ] What is safe to upgrade independently
- [ ] What requires coordinated upgrade
- [ ] Breaking change policy

#### LTS Declaration
- [ ] v0.5.x = LTS for protocol v1
- [ ] Support timeline
- [ ] Backport policy

---

## Phase 7C — Security Posture

### Deliverables

#### SECURITY.md
- [ ] Threat model
- [ ] What UDB protects
- [ ] What UDB does NOT protect
- [ ] Vulnerability reporting process

#### Key Lifecycle Tooling
- [ ] `udb keys list` - List all keys
- [ ] `udb keys rotate` - Rotate client key
- [ ] `udb keys export/import` - Backup/restore

#### Safe Defaults
- [ ] Warnings for `--pairing auto`
- [ ] Guardrails for shutdown/restart
- [ ] Audit logging recommendations

---

## Phase 7D — Governance & Project Stability

### Deliverables

#### CONTRIBUTING.md
- [ ] What belongs in core
- [ ] Protocol change rules
- [ ] Transport contribution guidelines
- [ ] Code review requirements

#### Decision Model
- [ ] Who approves protocol changes
- [ ] What requires major version bump
- [ ] RFC process for new features

#### Roadmap Freeze
- [ ] Explicit non-goals
- [ ] Future phases outline
- [ ] Prevents feature drift

---

## What Phase 7 Explicitly Excludes

❌ GUI
❌ Cloud relay
❌ Plugin system
❌ RBAC
❌ Scheduling / orchestration

Those are Phase 8+, only if demanded by real users.

---

## Execution Order

1. 🚧 Binary builds + installer (7A)
2. ⬜ Compatibility & upgrade guarantees (7B)
3. ⬜ Security documentation + tooling (7C)
4. ⬜ Governance & contribution rules (7D)

---

## Files to Create/Modify

### Phase 7A - Distribution
- `package.json` - Add pkg configuration
- `scripts/build-binaries.js` - Build script
- `scripts/install.sh` - Linux/macOS installer
- `scripts/install.ps1` - Windows installer
- `.github/workflows/release.yml` - Release automation

### Phase 7B - Compatibility
- `docs/COMPATIBILITY.md` - Version matrix
- `docs/UPGRADE.md` - Upgrade guide

### Phase 7C - Security
- `SECURITY.md` - Security policy
- `cli/src/udb.js` - Add keys subcommands

### Phase 7D - Governance
- `CONTRIBUTING.md` - Contribution guide
- `docs/GOVERNANCE.md` - Decision process
- `docs/ROADMAP.md` - Future plans
