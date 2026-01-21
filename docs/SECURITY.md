# Security Policy

## Reporting Vulnerabilities

**Do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via:

1. **Email**: tripathimukeshmani@outlook.com

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact assessment
- Any suggested fixes (optional)

### Response Timeline

| Phase | Timeline |
|-------|----------|
| Initial Response | 24-48 hours |
| Triage & Assessment | 1 week |
| Fix Development | 2 weeks (critical) / 4 weeks (high) |
| Disclosure | Coordinated with reporter |

We appreciate responsible disclosure and will acknowledge reporters in release notes (unless anonymity is requested).

---

## Security Model

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                     TRUST ZONE: Client Host                 │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐  │
│  │ CLI (udb)   │────▶│ @udb/client │────▶│ Auth Keys    │  │
│  └─────────────┘     └─────────────┘     │ (~/.udb/keys)│  │
│                                           └──────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ TLS 1.3 + ECDSA Auth
                           │ (Encrypted + Authenticated)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   TRUST ZONE: Device                        │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐  │
│  │ Daemon      │────▶│ Auth Module │────▶│ Paired Keys  │  │
│  │ (udbd)      │     └─────────────┘     │ (device-side)│  │
│  └─────────────┘                          └──────────────┘  │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    Device Resources                   │  │
│  │  • Filesystem    • Shell    • Process execution      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Threat Model

#### In Scope

| Threat | Mitigation |
|--------|------------|
| **Eavesdropping** | TLS 1.3 encryption on all communications |
| **Man-in-the-Middle** | ECDSA key-based authentication, no TOFU after pairing |
| **Unauthorized Access** | Explicit pairing required, key-based auth |
| **Key Theft** | Keys stored with restrictive permissions (0600) |
| **Replay Attacks** | TLS session management, nonce in protocol |
| **Denial of Service** | Connection limits, timeouts, resource caps |

#### Out of Scope

These threats require additional controls beyond UDB:

| Threat | Why Out of Scope | Recommendation |
|--------|------------------|----------------|
| **Compromised Client Host** | UDB keys accessible to local processes | Use OS-level access controls |
| **Compromised Device** | Device has full local access | Network segmentation |
| **Supply Chain** | npm package integrity | Verify checksums, use lockfiles |
| **Physical Access** | Physical device access bypasses all software | Physical security |

### Authentication Flow

```
  Client                              Device
    │                                    │
    │──────── TLS ClientHello ──────────▶│
    │◀─────── TLS ServerHello ───────────│
    │         (with device cert)         │
    │                                    │
    │──────── Client Certificate ───────▶│
    │         (ECDSA P-256)              │
    │                                    │
    │◀─────── Auth Challenge ────────────│
    │         (random nonce)             │
    │                                    │
    │──────── Signed Response ──────────▶│
    │         (ECDSA signature)          │
    │                                    │
    │◀─────── AUTH_OK ───────────────────│
    │                                    │
    │         Session Established        │
    │                                    │
```

---

## Cryptographic Details

### Algorithms

| Purpose | Algorithm | Key Size |
|---------|-----------|----------|
| Key Exchange | ECDH | P-256 (secp256r1) |
| Authentication | ECDSA | P-256 (secp256r1) |
| Encryption | AES-256-GCM | 256-bit |
| Key Derivation | HKDF-SHA256 | — |
| Hashing | SHA-256 | — |

### Key Storage

```
~/.udb/
├── keys/
│   ├── client.key        # Private key (0600)
│   ├── client.pub        # Public key (0644)
│   └── known_devices/    # Paired device public keys
│       ├── device-abc.pub
│       └── device-xyz.pub
└── config.json           # Configuration (0600)
```

**Permission Requirements:**
- Private keys: `0600` (owner read/write only)
- Public keys: `0644` (world readable)
- Config directory: `0700` (owner only)

### Key Generation

```bash
# Keys are generated during first pairing
udb pair <device-address>

# Manual key regeneration (invalidates all pairings)
udb keys regenerate
```

---

## Secure Defaults

UDB ships with secure defaults:

| Setting | Default | Rationale |
|---------|---------|-----------|
| TLS Version | 1.3 only | No legacy protocol support |
| Key Permissions | 0600 | Restrictive file access |
| Auth Required | Yes | No anonymous connections |
| Pairing Required | Yes | Explicit trust establishment |
| Connection Timeout | 30s | Prevent hanging connections |
| Max Connections | 100 | Resource exhaustion protection |

### Hardening Options

For high-security environments:

```javascript
// Strict TLS verification
const device = await connectDevice(address, {
  rejectUnauthorized: true,  // Default
  minTLSVersion: 'TLSv1.3'   // Default
});
```

---

## Operational Security

### Key Lifecycle

| Phase | Recommendation |
|-------|----------------|
| **Generation** | Generate on secure host, never share private keys |
| **Distribution** | Transfer public keys only, verify fingerprints out-of-band |
| **Storage** | Encrypted disk, backup securely |
| **Rotation** | Annual rotation recommended, re-pair devices |
| **Revocation** | Remove from `known_devices/`, update device pairing |
| **Destruction** | Secure delete, update all paired devices |

### Audit Logging

Enable verbose logging for security auditing:

```bash
# CLI
UDB_LOG_LEVEL=debug udb devices

# Programmatic
import { setLogLevel } from "@udb/client";
setLogLevel("debug");
```

Logs include:
- Connection attempts (success/failure)
- Authentication events
- Command execution (without sensitive args)
- File transfers (paths only, not content)

### Network Security

**Recommended network configuration:**

1. **Segment device networks** from general corporate networks
2. **Firewall rules** allowing only necessary ports (default: 5555)
3. **No internet exposure** for device management ports
4. **VPN access** for remote management

---

## Vulnerability History

| CVE | Version | Severity | Description | Fixed In |
|-----|---------|----------|-------------|----------|
| — | — | — | No vulnerabilities reported | — |

---

## Security Checklist

### For Users

- [ ] Keep UDB updated to latest version
- [ ] Verify downloaded binaries with checksums
- [ ] Protect `~/.udb/keys/` directory
- [ ] Use strong, unique passwords for any optional auth
- [ ] Review paired devices regularly (`udb devices`)
- [ ] Use on trusted networks only

### For Developers Integrating UDB

- [ ] Store keys securely (encrypted at rest)
- [ ] Never log private keys or sensitive data
- [ ] Validate all paths to prevent traversal
- [ ] Handle errors without leaking information
- [ ] Set appropriate timeouts
- [ ] Limit concurrent connections

### For Device Daemon Deployers

- [ ] Run daemon with minimal privileges
- [ ] Restrict filesystem access where possible
- [ ] Enable system audit logging
- [ ] Monitor for unusual connection patterns
- [ ] Keep device firmware/OS updated

---

## Compliance Notes

UDB is designed to support compliance with common security frameworks:

| Framework | Relevant Controls |
|-----------|------------------|
| **SOC 2** | Access control, encryption, audit logging |
| **ISO 27001** | A.10 Cryptography, A.13 Communications Security |
| **NIST CSF** | PR.AC (Access Control), PR.DS (Data Security) |
| **HIPAA** | Encryption, access controls (for healthcare devices) |

*Note: UDB provides security controls; compliance depends on overall deployment.*

---

## Contact

- **Bug Reports**: https://github.com/mukesh-scs/udb/issues
