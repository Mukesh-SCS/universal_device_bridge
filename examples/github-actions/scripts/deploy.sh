#!/bin/bash
#
# Example deployment script for UDB
#
# Usage:
#   ./deploy.sh <target> <app-binary>
#
# Example:
#   ./deploy.sh 192.168.1.100:9910 ./build/myapp.bin

set -e

TARGET="${1:?Usage: deploy.sh <target> <app-binary>}"
APP_BINARY="${2:?Usage: deploy.sh <target> <app-binary>}"

echo "=== UDB Deployment Script ==="
echo "Target: $TARGET"
echo "Binary: $APP_BINARY"
echo ""

# Check device connectivity
echo "1. Checking device connectivity..."
if ! udb ping "$TARGET" > /dev/null 2>&1; then
    echo "ERROR: Cannot reach device at $TARGET"
    udb doctor "$TARGET"
    exit 1
fi
echo "   ✓ Device is reachable"

# Get device info
echo "2. Getting device info..."
DEVICE_INFO=$(udb info "$TARGET" --json)
DEVICE_NAME=$(echo "$DEVICE_INFO" | jq -r '.name')
DEVICE_VERSION=$(echo "$DEVICE_INFO" | jq -r '.version')
echo "   Device: $DEVICE_NAME v$DEVICE_VERSION"

# Stop application
echo "3. Stopping application..."
udb exec "$TARGET" "systemctl stop myapp || true"
echo "   ✓ Application stopped"

# Push new binary
echo "4. Pushing new binary..."
udb push "$TARGET" "$APP_BINARY" /opt/myapp/app.bin
echo "   ✓ Binary uploaded"

# Start application
echo "5. Starting application..."
udb exec "$TARGET" "systemctl start myapp"
echo "   ✓ Application started"

# Verify
echo "6. Verifying deployment..."
sleep 2
if udb exec "$TARGET" "systemctl is-active myapp" > /dev/null 2>&1; then
    echo "   ✓ Application is running"
else
    echo "   ✗ Application failed to start"
    echo ""
    echo "Logs:"
    udb exec "$TARGET" "journalctl -u myapp -n 50 --no-pager"
    exit 1
fi

echo ""
echo "=== Deployment Complete ==="
