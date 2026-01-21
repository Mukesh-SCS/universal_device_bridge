#!/bin/bash
#
# UDB Installer for Linux and macOS
#
# Usage:
#   curl -fsSL https://udb.pages.dev/install.sh | sh
#
# Options:
#   --version <ver>   Install specific version (default: latest)
#   --dir <path>      Install directory (default: /usr/local/bin)
#   --no-verify       Skip checksum verification
#

set -euo pipefail

# Configuration
VERSION="${UDB_VERSION:-latest}"
INSTALL_DIR="${UDB_INSTALL_DIR:-/usr/local/bin}"
VERIFY_CHECKSUM=true
REPO="tripa2020/universal_device_bridge"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
  echo -e "${BLUE}[udb]${NC} $1"
}

success() {
  echo -e "${GREEN}[udb]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[udb]${NC} $1"
}

error() {
  echo -e "${RED}[udb]${NC} $1" >&2
}

die() {
  error "$1"
  exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --no-verify)
      VERIFY_CHECKSUM=false
      shift
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

# Detect platform
detect_platform() {
  local os arch

  case "$(uname -s)" in
    Linux*)  os="linux" ;;
    Darwin*) os="macos" ;;
    MINGW*|MSYS*|CYGWIN*) 
      die "Windows detected. Please use install.ps1 instead."
      ;;
    *)
      die "Unsupported operating system: $(uname -s)"
      ;;
  esac

  case "$(uname -m)" in
    x86_64|amd64)  arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)
      die "Unsupported architecture: $(uname -m)"
      ;;
  esac

  echo "${os}-${arch}"
}

# Get latest version from GitHub
get_latest_version() {
  local latest
  latest=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
  echo "${latest#v}"  # Strip 'v' prefix if present
}

# Download with progress
download() {
  local url="$1"
  local dest="$2"

  if command -v curl &> /dev/null; then
    curl -fsSL --progress-bar -o "$dest" "$url"
  elif command -v wget &> /dev/null; then
    wget -q --show-progress -O "$dest" "$url"
  else
    die "Neither curl nor wget found. Please install one of them."
  fi
}

# Verify checksum
verify() {
  local file="$1"
  local expected="$2"

  if command -v sha256sum &> /dev/null; then
    local actual=$(sha256sum "$file" | awk '{print $1}')
  elif command -v shasum &> /dev/null; then
    local actual=$(shasum -a 256 "$file" | awk '{print $1}')
  else
    warn "No sha256sum or shasum available, skipping verification"
    return 0
  fi

  if [[ "$actual" != "$expected" ]]; then
    die "Checksum mismatch!\n  Expected: $expected\n  Got: $actual"
  fi
}

main() {
  log "UDB Installer"
  log "────────────────────────────────────"

  # Detect platform
  local platform=$(detect_platform)
  log "Detected platform: $platform"

  # Resolve version
  if [[ "$VERSION" == "latest" ]]; then
    log "Fetching latest version..."
    VERSION=$(get_latest_version)
  fi
  log "Version: $VERSION"

  # Build download URL
  local binary_name="udb-${platform}"
  local download_url="https://github.com/${REPO}/releases/download/v${VERSION}/${binary_name}"
  local checksum_url="https://github.com/${REPO}/releases/download/v${VERSION}/SHA256SUMS"

  log "Downloading from: $download_url"

  # Create temp directory
  local tmp_dir=$(mktemp -d)
  trap "rm -rf $tmp_dir" EXIT

  # Download binary
  local tmp_binary="${tmp_dir}/udb"
  download "$download_url" "$tmp_binary"

  # Verify checksum
  if [[ "$VERIFY_CHECKSUM" == true ]]; then
    log "Verifying checksum..."
    local checksums="${tmp_dir}/SHA256SUMS"
    download "$checksum_url" "$checksums"
    
    local expected=$(grep "$binary_name" "$checksums" | awk '{print $1}')
    if [[ -n "$expected" ]]; then
      verify "$tmp_binary" "$expected"
      success "Checksum verified"
    else
      warn "No checksum found for $binary_name, skipping verification"
    fi
  fi

  # Make executable
  chmod +x "$tmp_binary"

  # Install
  log "Installing to $INSTALL_DIR..."
  
  if [[ -w "$INSTALL_DIR" ]]; then
    mv "$tmp_binary" "${INSTALL_DIR}/udb"
  else
    log "Elevated permissions required..."
    sudo mv "$tmp_binary" "${INSTALL_DIR}/udb"
  fi

  success "────────────────────────────────────"
  success "UDB v${VERSION} installed successfully!"
  success ""
  success "Run 'udb --help' to get started."
  
  # Verify installation
  if command -v udb &> /dev/null; then
    log ""
    log "Installed version:"
    udb --version || true
  else
    warn ""
    warn "udb is not in your PATH."
    warn "Add $INSTALL_DIR to your PATH, or run:"
    warn "  export PATH=\"\$PATH:$INSTALL_DIR\""
  fi
}

main
