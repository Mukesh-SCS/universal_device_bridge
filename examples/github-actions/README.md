# UDB GitHub Actions Integration

This example demonstrates how to use UDB in a CI/CD pipeline with GitHub Actions.

## Overview

This workflow shows:
1. Running the UDB simulator in CI
2. Pairing with the device
3. Running commands
4. Collecting logs and artifacts

## Quick Start

Copy `.github/workflows/udb-example.yml` to your repository.

## Files

- `workflows/udb-example.yml` - Example GitHub Actions workflow
- `scripts/deploy.sh` - Example deployment script

## Usage Patterns

### Basic Command Execution

```yaml
- name: Run command on device
  run: udb exec ${{ env.DEVICE_TARGET }} "systemctl restart myapp"
```

### Check Exit Codes

```yaml
- name: Verify service running
  run: |
    udb exec ${{ env.DEVICE_TARGET }} "systemctl is-active myapp"
```

### JSON Output for Parsing

```yaml
- name: Get device info
  id: device-info
  run: |
    info=$(udb info ${{ env.DEVICE_TARGET }} --json)
    echo "version=$(echo $info | jq -r '.version')" >> $GITHUB_OUTPUT
```

### Fleet Operations

```yaml
- name: Deploy to cluster
  run: |
    udb group add cluster 10.0.0.1:9910 10.0.0.2:9910 10.0.0.3:9910
    udb group exec cluster "systemctl restart myapp"
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `UDB_TARGET` | Default target for commands |
| `UDB_CONFIG_DIR` | Custom config directory |
| `UDB_TIMEOUT` | Default timeout in ms |

## Security Considerations

1. **Keypair Management**: Store client keypair as a GitHub secret
2. **Network Access**: Ensure runners can reach devices
3. **Pairing**: Use auto-pairing for CI or pre-paired keys

## Troubleshooting

### Connection Refused

```yaml
- name: Diagnose connectivity
  run: udb doctor ${{ env.DEVICE_TARGET }}
```

### Authentication Failed

Ensure the keypair is correctly set up:

```yaml
- name: Setup UDB keypair
  run: |
    mkdir -p ~/.udb
    echo "${{ secrets.UDB_PRIVATE_KEY }}" > ~/.udb/id_ed25519
    echo "${{ secrets.UDB_PUBLIC_KEY }}" > ~/.udb/id_ed25519.pub
    chmod 600 ~/.udb/id_ed25519
```
