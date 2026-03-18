# Agios CLI - Installation

This directory hosts the Agios CLI binary and installation script for HTTP distribution.

## Quick Install

### One-Command Installation (Recommended)

The install script automatically detects your environment (localhost vs production):

```bash
# Localhost development
curl -fsSL http://localhost:5173/install.sh | bash

# Production
curl -fsSL https://agios.dev/install.sh | bash
```

**Smart Features:**
- Auto-detects origin (localhost vs production)
- Downloads correct binary for your platform
- Creates `.agent/config.json` with proper API URL
- Installs to `~/.local/bin/agios`
- Verifies installation automatically
- Preserves existing configuration on reinstall

### Custom Origin

Override detected origin:

```bash
AGIOS_ORIGIN="custom.domain.com" curl -fsSL http://localhost:5173/install.sh | bash
```

### Manual Download

Download the binary directly:

```bash
# macOS ARM64 (M1/M2/M3)
curl -L http://localhost:5173/bin/agios-darwin-arm64 -o agios
chmod +x agios
sudo mv agios /usr/local/bin/
```

## Available Binaries

Check the [manifest.json](./bin/manifest.json) for available platforms and versions.

Current platforms:
- **darwin-arm64**: macOS Apple Silicon (M1/M2/M3)

Future platforms:
- **darwin-x64**: macOS Intel
- **linux-x64**: Linux x86_64
- **linux-arm64**: Linux ARM64
- **windows-x64**: Windows x86_64

## Origin Detection

The install script uses smart origin detection:

### Detection Priority
1. **AGIOS_ORIGIN** environment variable (explicit override)
2. **HTTP_HOST** from curl request (when served by web server)
3. **Default** to localhost:5173

### Localhost Mode
- Detected when origin contains "localhost" or "127.0.0.1"
- API URL: `http://localhost:3000`
- Base URL: `http://localhost:5173`

### Production Mode
- Any other domain
- API URL: `https://{origin}/api`
- Base URL: `https://{origin}`

## Configuration

After installation, `.agent/config.json` is created in the current directory:

```json
{
  "projectId": "uuid-generated",
  "baseUrl": "http://localhost:3000",
  "debugHooks": false,
  "createdAt": "2025-11-08T20:00:00Z",
  "installedBy": "install.sh",
  "platform": "macOS (ARM64)",
  "origin": "localhost:5173"
}
```

## Verify Installation

```bash
agios --version
agios --help
```

## PATH Configuration

If `~/.local/bin` is not in your PATH:

**Bash** (`~/.bashrc`):
```bash
export PATH="$HOME/.local/bin:$PATH"
```

**Zsh** (`~/.zshrc`):
```bash
export PATH="$HOME/.local/bin:$PATH"
```

Then: `source ~/.bashrc` (or `~/.zshrc`)

## Binary Naming Convention

Binaries follow the pattern: `agios-{platform}-{arch}`

Examples:
- `agios-darwin-arm64` - macOS Apple Silicon
- `agios-darwin-x64` - macOS Intel
- `agios-linux-x64` - Linux x86_64
- `agios-windows-x64.exe` - Windows

## Version Information

The `manifest.json` file contains:
- Current version number
- Build timestamp
- Git commit hash
- Platform-specific binary metadata (URL, size, build time)

## Building Binaries

Binaries are automatically copied to this directory during the build process:

```bash
cd apps/cli
bun run build
```

The build script:
1. Compiles the CLI binary
2. Copies it to `apps/web/public/bin/agios-{platform}-{arch}`
3. Updates `manifest.json` with version and size information

## Development

To test binary downloads locally:

1. Start the web server:
   ```bash
   cd apps/web
   bun dev
   ```

2. Download the binary:
   ```bash
   curl http://localhost:5173/bin/agios-darwin-arm64 -o agios
   chmod +x agios
   ./agios --version
   ```

## Security

Binaries are served over HTTPS in production. The install script verifies:
- Binary downloads successfully
- Binary is executable
- Installation location is in PATH

## Support

For issues or questions:
- GitHub: https://github.com/agios/agios
- Documentation: https://docs.agios.dev
