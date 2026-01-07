# Linux Device Examples

This directory contains examples for deploying UDB daemon on Linux devices.

## Quick Start

```bash
# Start daemon on target Linux device
node daemon/linux/udbd.js --pairing auto

# From client, discover and connect
udb devices
udb pair <ip>:9910
udb exec "uname -a"
```

## Target Platforms

- **x86/x64 servers** - Standard Linux servers
- **ARM devices** - Raspberry Pi, BeagleBone, etc.
- **Embedded Linux** - OpenWrt, Yocto-based systems
- **Cloud VMs** - AWS, GCP, Azure instances

## Deployment Options

### Systemd Service

```ini
# /etc/systemd/system/udbd.service
[Unit]
Description=Universal Device Bridge Daemon
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /opt/udb/daemon/linux/udbd.js --pairing auto
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

### Docker

```dockerfile
FROM node:20-slim
COPY daemon/linux /app
WORKDIR /app
EXPOSE 9909/udp 9910/tcp
CMD ["node", "udbd.js", "--pairing", "auto"]
```

## Security Considerations

- Use `--pairing prompt` for manual approval in production
- Run with minimal privileges where possible
- Use `--root` to restrict file transfer paths
- Consider firewall rules for ports 9909/9910
