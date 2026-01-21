# UDB Cloud Services (Optional)

Optional cloud services that enhance UDB without compromising its local-first nature.

## Core Principle

> **All cloud features are strictly opt-in. UDB works 100% offline by default.**

## Available Services

### 1. Discovery Relay

Helps devices find each other across different networks:

```
┌─────────────────┐         ┌─────────────────┐
│   Client        │         │   Device        │
│   (Office)      │         │   (Factory)     │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │    ┌─────────────────┐    │
         └───▶│  Discovery      │◀───┘
              │  Relay          │
              └─────────────────┘
```

**How it works:**
- Devices register their presence with relay
- Clients query relay to find devices
- All actual communication is still direct P2P
- Relay never sees command data

### 2. Fleet Registry

Optional centralized storage for fleet metadata:

- Device names and labels
- Group definitions
- Historical status snapshots
- Audit logs (who did what when)

**NOT stored:**
- Authentication keys (always local)
- Command output (always direct)
- File contents (always direct)

### 3. Status Dashboard

Web-based dashboard for fleet visibility:

- Device online/offline status
- Recent command history
- Fleet health overview
- Alerts and notifications

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        CLOUD LAYER (Optional)                   │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Discovery   │  │    Fleet     │  │      Dashboard       │  │
│  │   Relay      │  │   Registry   │  │        API           │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (metadata only)
                              │
┌────────────────────────────────────────────────────────────────┐
│                         LOCAL LAYER                             │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐                    ┌──────────────────────┐  │
│  │  udb CLI     │◀──── TCP/UDP ────▶│       udbd           │  │
│  │  @udb/client │   (direct, local) │     (device)         │  │
│  └──────────────┘                    └──────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Configuration

```bash
# Enable cloud relay (opt-in)
udb config set cloud.enabled true
udb config set cloud.relay https://relay.udb.example.com

# Disable cloud (default)
udb config set cloud.enabled false
```

## Self-Hosting

All cloud services can be self-hosted:

```bash
# Run your own relay
docker run -p 8080:8080 udb/relay

# Point UDB to your relay
udb config set cloud.relay http://localhost:8080
```

## Privacy

- No telemetry collected
- No usage data sent
- All cloud features can be disabled
- Self-hosting fully supported
- Data never leaves your network without explicit opt-in

## Status

| Service | Status | Self-Host |
|---------|--------|-----------|
| Discovery Relay | 🔲 Planned | ✅ Yes |
| Fleet Registry | 🔲 Planned | ✅ Yes |
| Dashboard | 🔲 Planned | ✅ Yes |
