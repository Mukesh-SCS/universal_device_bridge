#Requires -Version 5.1
<#
.SYNOPSIS
    UDB Installer for Windows

.DESCRIPTION
    Downloads and installs UDB (Universal Device Bridge) on Windows.

.PARAMETER Version
    Specific version to install. Default: latest

.PARAMETER InstallDir
    Installation directory. Default: $env:LOCALAPPDATA\udb

.PARAMETER NoVerify
    Skip checksum verification

.PARAMETER AddToPath
    Add installation directory to user PATH. Default: true

.EXAMPLE
    # Install latest version
    irm https://udb.pages.dev/install.ps1 | iex

.EXAMPLE
    # Install specific version
    .\install.ps1 -Version 0.7.0

.EXAMPLE
    # Install to custom directory
    .\install.ps1 -InstallDir "C:\tools\udb"
#>

[CmdletBinding()]
param(
    [string]$Version = "latest",
    [string]$InstallDir = "$env:LOCALAPPDATA\udb",
    [switch]$NoVerify,
    [bool]$AddToPath = $true
)

# Configuration
$Repo = "Mukesh-SCS/universal_device_bridge"
$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$Message)
    Write-Host "[udb] " -ForegroundColor Blue -NoNewline
    Write-Host $Message
}

function Write-Success {
    param([string]$Message)
    Write-Host "[udb] " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[udb] " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Err {
    param([string]$Message)
    Write-Host "[udb] " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

function Get-LatestVersion {
    $releaseUrl = "https://api.github.com/repos/$Repo/releases/latest"
    try {
        $release = Invoke-RestMethod -Uri $releaseUrl -UseBasicParsing
        return $release.tag_name -replace '^v', ''
    }
    catch {
        throw "Failed to fetch latest version: $_"
    }
}

function Get-Checksum {
    param(
        [string]$FilePath
    )
    $hash = Get-FileHash -Path $FilePath -Algorithm SHA256
    return $hash.Hash.ToLower()
}

function Test-Checksum {
    param(
        [string]$FilePath,
        [string]$Expected
    )
    $actual = Get-Checksum -FilePath $FilePath
    if ($actual -ne $Expected.ToLower()) {
        throw "Checksum mismatch!`n  Expected: $Expected`n  Got: $actual"
    }
}

function Add-ToUserPath {
    param([string]$Directory)
    
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    
    if ($currentPath -notlike "*$Directory*") {
        $newPath = "$currentPath;$Directory"
        [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
        Write-Status "Added $Directory to user PATH"
        Write-Warn "Restart your terminal for PATH changes to take effect"
    }
    else {
        Write-Status "$Directory already in PATH"
    }
}

function Install-UDB {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║     UDB Installer for Windows          ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""

    # Detect architecture
    $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    if ($arch -eq "x86") {
        throw "UDB requires 64-bit Windows"
    }
    Write-Status "Platform: win-$arch"

    # Resolve version
    if ($Version -eq "latest") {
        Write-Status "Fetching latest version..."
        $Version = Get-LatestVersion
    }
    Write-Status "Version: $Version"

    # Build URLs
    $binaryName = "udb-win-x64.exe"
    $downloadUrl = "https://github.com/$Repo/releases/download/v$Version/$binaryName"
    $checksumUrl = "https://github.com/$Repo/releases/download/v$Version/SHA256SUMS"

    Write-Status "Download URL: $downloadUrl"

    # Create temp directory
    $tempDir = Join-Path $env:TEMP "udb-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    try {
        # Download binary
        $tempBinary = Join-Path $tempDir "udb.exe"
        Write-Status "Downloading..."
        
        $ProgressPreference = 'SilentlyContinue'  # Faster downloads
        Invoke-WebRequest -Uri $downloadUrl -OutFile $tempBinary -UseBasicParsing

        # Verify checksum
        if (-not $NoVerify) {
            Write-Status "Verifying checksum..."
            $checksumFile = Join-Path $tempDir "SHA256SUMS"
            
            try {
                Invoke-WebRequest -Uri $checksumUrl -OutFile $checksumFile -UseBasicParsing
                $checksums = Get-Content $checksumFile
                $expectedLine = $checksums | Where-Object { $_ -match $binaryName }
                
                if ($expectedLine) {
                    $expected = ($expectedLine -split '\s+')[0]
                    Test-Checksum -FilePath $tempBinary -Expected $expected
                    Write-Success "Checksum verified"
                }
                else {
                    Write-Warn "No checksum found for $binaryName, skipping verification"
                }
            }
            catch {
                Write-Warn "Could not verify checksum: $_"
            }
        }

        # Create install directory
        if (-not (Test-Path $InstallDir)) {
            New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        }

        # Install binary
        $installPath = Join-Path $InstallDir "udb.exe"
        Write-Status "Installing to $installPath..."
        
        # Remove old version if exists
        if (Test-Path $installPath) {
            Remove-Item $installPath -Force
        }
        
        Move-Item $tempBinary $installPath -Force

        # Add to PATH
        if ($AddToPath) {
            Add-ToUserPath -Directory $InstallDir
        }

        Write-Host ""
        Write-Success "════════════════════════════════════════"
        Write-Success "UDB v$Version installed successfully!"
        Write-Success ""
        Write-Success "Run 'udb --help' to get started."
        Write-Host ""

        # Verify installation
        try {
            $versionOutput = & $installPath --version 2>&1
            Write-Status "Installed: $versionOutput"
        }
        catch {
            Write-Warn "Installation complete, but could not verify version"
        }
    }
    finally {
        # Cleanup
        if (Test-Path $tempDir) {
            Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# Run installer
try {
    Install-UDB
}
catch {
    Write-Err "Installation failed: $_"
    exit 1
}
