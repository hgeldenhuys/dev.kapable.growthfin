#!/bin/bash
set -e

# ==============================================================================
# Agios CLI Installer with Smart Origin Detection
# ==============================================================================
#
# Usage:
#   curl -fsSL http://localhost:5173/install.sh | bash
#   curl -fsSL https://agios.dev/install.sh | bash
#   curl -fsSL https://agios.dev/install.sh | bash -s -- --skip-binary
#   AGIOS_ORIGIN=custom.domain.com bash install.sh
#
# Features:
#   - Auto-detects origin (localhost vs production)
#   - Downloads platform-specific binary
#   - Creates .agent/ configuration
#   - Installs to user's PATH
#   - Verifies installation
#   - Supports non-interactive mode (--skip-binary)
#
# ==============================================================================

# ------------------------------------------------------------------------------
# Command Line Arguments
# ------------------------------------------------------------------------------

# Parse command line flags
SKIP_BINARY=false
for arg in "$@"; do
  case $arg in
    --skip-binary)
      SKIP_BINARY=true
      shift
      ;;
  esac
done

# ------------------------------------------------------------------------------
# Colors and Formatting
# ------------------------------------------------------------------------------

if [ -t 1 ]; then
  GREEN='\033[0;32m'
  BLUE='\033[0;34m'
  YELLOW='\033[1;33m'
  RED='\033[0;31m'
  BOLD='\033[1m'
  DIM='\033[2m'
  NC='\033[0m'
else
  GREEN=''
  BLUE=''
  YELLOW=''
  RED=''
  BOLD=''
  DIM=''
  NC=''
fi

# ------------------------------------------------------------------------------
# Helper Functions
# ------------------------------------------------------------------------------

log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

log_step() {
  echo -e "\n${BOLD}$1${NC}"
}

# ------------------------------------------------------------------------------
# Requirements Check
# ------------------------------------------------------------------------------

check_requirements() {
  log_step "Checking requirements..."

  # Check for curl or wget
  if command -v curl >/dev/null 2>&1; then
    DOWNLOADER="curl"
    log_success "Found curl"
  elif command -v wget >/dev/null 2>&1; then
    DOWNLOADER="wget"
    log_success "Found wget"
  else
    log_error "Neither curl nor wget found. Please install one of them."
    exit 1
  fi

  # Check for uuidgen
  if ! command -v uuidgen >/dev/null 2>&1; then
    log_warning "uuidgen not found. Will use timestamp for project ID."
    HAS_UUIDGEN=false
  else
    HAS_UUIDGEN=true
    log_success "Found uuidgen"
  fi
}

# ------------------------------------------------------------------------------
# Origin Detection
# ------------------------------------------------------------------------------

detect_origin() {
  log_step "Detecting origin..."

  # Priority 1: Explicit environment variable (user override)
  if [ -n "$AGIOS_ORIGIN" ]; then
    ORIGIN="$AGIOS_ORIGIN"
    log_info "Using explicit AGIOS_ORIGIN: $ORIGIN"
  # Priority 2: HTTP_HOST from curl (when served by Web server)
  elif [ -n "$HTTP_HOST" ]; then
    ORIGIN="$HTTP_HOST"
    log_info "Detected HTTP_HOST: $ORIGIN"
  # Priority 3: Default to localhost
  else
    ORIGIN="localhost:5173"
    log_info "Defaulting to: $ORIGIN"
  fi

  # Determine base URL based on origin
  # Note: baseUrl in config.json is used by hooks-sdk which appends /api automatically
  if [[ "$ORIGIN" == *"localhost"* ]] || [[ "$ORIGIN" == *"127.0.0.1"* ]]; then
    BASE_URL="http://localhost:5173"
    CONFIG_BASE_URL="http://localhost:5173"  # For config.json (SDK appends /api)
    log_success "Detected localhost environment"
  else
    BASE_URL="https://${ORIGIN}"
    CONFIG_BASE_URL="https://${ORIGIN}"  # For config.json (SDK appends /api)
    log_success "Detected production environment"
  fi

  log_info "Base URL: $BASE_URL"
  log_info "API will be accessed at: ${CONFIG_BASE_URL}/api"
}

# ------------------------------------------------------------------------------
# Platform Detection
# ------------------------------------------------------------------------------

detect_platform() {
  log_step "Detecting platform..."

  # Get OS
  OS_RAW=$(uname -s)
  case "$OS_RAW" in
    Darwin*)
      OS="darwin"
      OS_NAME="macOS"
      ;;
    Linux*)
      OS="linux"
      OS_NAME="Linux"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      OS="windows"
      OS_NAME="Windows"
      ;;
    *)
      log_error "Unsupported operating system: $OS_RAW"
      exit 1
      ;;
  esac

  # Get architecture
  ARCH_RAW=$(uname -m)
  case "$ARCH_RAW" in
    x86_64|amd64)
      ARCH="x64"
      ARCH_NAME="x86_64"
      ;;
    arm64|aarch64)
      ARCH="arm64"
      ARCH_NAME="ARM64"
      ;;
    armv7l)
      ARCH="armv7"
      ARCH_NAME="ARMv7"
      ;;
    *)
      log_error "Unsupported architecture: $ARCH_RAW"
      exit 1
      ;;
  esac

  log_success "Platform: $OS_NAME ($ARCH_NAME)"

  # Currently only macOS ARM64 is built
  if [ "$OS" != "darwin" ] || [ "$ARCH" != "arm64" ]; then
    log_warning "Currently only macOS ARM64 is officially supported."
    log_warning "Attempting to download anyway..."
  fi
}

# ------------------------------------------------------------------------------
# Download Binary
# ------------------------------------------------------------------------------

download_binary() {
  log_step "Downloading Agios CLI..."

  # Construct binary URL
  BINARY_NAME="agios-${OS}-${ARCH}"
  BINARY_URL="${BASE_URL}/bin/${BINARY_NAME}"

  # For macOS, the binary is just named "agios"
  if [ "$OS" = "darwin" ]; then
    BINARY_URL="${BASE_URL}/bin/agios"
  fi

  log_info "Download URL: $BINARY_URL"

  # Create temp directory
  TMP_DIR=$(mktemp -d)
  TMP_BINARY="$TMP_DIR/agios"

  # Download binary
  if [ "$DOWNLOADER" = "curl" ]; then
    if ! curl -fsSL "$BINARY_URL" -o "$TMP_BINARY"; then
      log_error "Failed to download binary from $BINARY_URL"
      log_info "Please check:"
      log_info "  1. The binary has been built (bun run build)"
      log_info "  2. The binary is hosted at the correct location"
      log_info "  3. Your network connection"
      rm -rf "$TMP_DIR"
      exit 1
    fi
  else
    if ! wget -q "$BINARY_URL" -O "$TMP_BINARY"; then
      log_error "Failed to download binary from $BINARY_URL"
      rm -rf "$TMP_DIR"
      exit 1
    fi
  fi

  # Verify download
  if [ ! -f "$TMP_BINARY" ] || [ ! -s "$TMP_BINARY" ]; then
    log_error "Downloaded binary is empty or missing"
    rm -rf "$TMP_DIR"
    exit 1
  fi

  BINARY_SIZE=$(stat -f%z "$TMP_BINARY" 2>/dev/null || stat -c%s "$TMP_BINARY" 2>/dev/null || echo "unknown")
  log_success "Downloaded binary (size: $BINARY_SIZE bytes)"
}

# ------------------------------------------------------------------------------
# Install Binary
# ------------------------------------------------------------------------------

install_binary() {
  log_step "Installing binary..."

  # Determine install location
  INSTALL_DIR="${HOME}/.local/bin"
  INSTALL_PATH="${INSTALL_DIR}/agios"

  # Create install directory if needed
  if [ ! -d "$INSTALL_DIR" ]; then
    mkdir -p "$INSTALL_DIR"
    log_info "Created directory: $INSTALL_DIR"
  fi

  # Check if binary already exists
  if [ -f "$INSTALL_PATH" ]; then
    log_warning "Agios CLI is already installed at: $INSTALL_PATH"
    read -p "Do you want to overwrite it? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      log_info "Installation cancelled"
      rm -rf "$TMP_DIR"
      exit 0
    fi
  fi

  # Make binary executable
  chmod +x "$TMP_BINARY"

  # Move binary to install location
  if mv "$TMP_BINARY" "$INSTALL_PATH"; then
    log_success "Installed binary to: $INSTALL_PATH"
  else
    log_error "Failed to install binary to $INSTALL_PATH"
    log_info "You may need to run with sudo or check directory permissions"
    rm -rf "$TMP_DIR"
    exit 1
  fi

  # Cleanup temp directory
  rm -rf "$TMP_DIR"
}

# ------------------------------------------------------------------------------
# Create Configuration
# ------------------------------------------------------------------------------

create_config() {
  log_step "Creating configuration..."

  # Create .agent directory in current directory
  AGENT_DIR="${PWD}/.agent"
  CONFIG_PATH="${AGENT_DIR}/config.json"

  # Create directory if needed
  if [ ! -d "$AGENT_DIR" ]; then
    mkdir -p "$AGENT_DIR"
    log_info "Created directory: $AGENT_DIR"
  fi

  # Generate project ID
  if [ "$HAS_UUIDGEN" = true ]; then
    PROJECT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
  else
    PROJECT_ID="project-$(date +%s)"
  fi

  # Check if config already exists
  if [ -f "$CONFIG_PATH" ]; then
    log_warning "Configuration already exists at: $CONFIG_PATH"
    log_info "Skipping config creation to preserve existing settings"
    return 0
  fi

  # Create config.json
  cat > "$CONFIG_PATH" <<EOF
{
  "projectId": "$PROJECT_ID",
  "baseUrl": "$CONFIG_BASE_URL",
  "debugHooks": false,
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "installedBy": "install.sh",
  "platform": "$OS_NAME ($ARCH_NAME)",
  "origin": "$ORIGIN"
}
EOF

  log_success "Created configuration: $CONFIG_PATH"
  log_info "Project ID: $PROJECT_ID"
}

# ------------------------------------------------------------------------------
# Copy Hooks Script
# ------------------------------------------------------------------------------

copy_hooks_script() {
  log_step "Installing hooks script..."

  mkdir -p .agent

  if [ "$DOWNLOADER" = "curl" ]; then
    if curl -fsSL "${BASE_URL}/hooks/hooks.ts" -o .agent/hooks.ts; then
      chmod +x .agent/hooks.ts
      log_success "Hooks script installed to .agent/hooks.ts"
    else
      log_error "Failed to download hooks script"
      log_warning "Hooks will not be functional"
      return 1
    fi
  else
    if wget -q "${BASE_URL}/hooks/hooks.ts" -O .agent/hooks.ts; then
      chmod +x .agent/hooks.ts
      log_success "Hooks script installed to .agent/hooks.ts"
    else
      log_error "Failed to download hooks script"
      log_warning "Hooks will not be functional"
      return 1
    fi
  fi
}

# ------------------------------------------------------------------------------
# Configure Claude Code Hooks
# ------------------------------------------------------------------------------

configure_claude_hooks() {
  log_step "Configuring Claude Code hooks..."

  mkdir -p .claude

  # Backup existing settings if present
  if [ -f .claude/settings.json ]; then
    log_info "Backing up existing .claude/settings.json"
    cp .claude/settings.json .claude/settings.json.backup.$(date +%s)
  fi

  # Create hooks configuration
  cat > .claude/settings.json <<'SETTINGS_EOF'
{
  "hooks": {
    "SessionStart": {
      "command": "bun .agent/hooks.ts"
    },
    "SessionEnd": {
      "command": "bun .agent/hooks.ts"
    },
    "Stop": {
      "command": "bun .agent/hooks.ts"
    },
    "PreToolUse": {
      "command": "bun .agent/hooks.ts"
    },
    "PostToolUse": {
      "command": "bun .agent/hooks.ts"
    },
    "UserPromptSubmit": {
      "command": "bun .agent/hooks.ts"
    }
  }
}
SETTINGS_EOF

  log_success "Claude Code hooks configured in .claude/settings.json"
  log_info "Restart Claude Code to activate hooks"
}

# ------------------------------------------------------------------------------
# Verify Installation
# ------------------------------------------------------------------------------

verify_installation() {
  log_step "Verifying installation..."

  # Check if binary is in PATH
  if ! command -v agios >/dev/null 2>&1; then
    log_warning "Binary not found in PATH"
    log_info "Please add $INSTALL_DIR to your PATH:"

    # Detect shell
    if [ -n "$BASH_VERSION" ]; then
      SHELL_RC="$HOME/.bashrc"
    elif [ -n "$ZSH_VERSION" ]; then
      SHELL_RC="$HOME/.zshrc"
    else
      SHELL_RC="$HOME/.profile"
    fi

    echo -e "\n${DIM}# Add to $SHELL_RC:${NC}"
    echo -e "${BLUE}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}\n"

    log_info "Then restart your shell or run:"
    echo -e "${BLUE}source $SHELL_RC${NC}\n"
  else
    log_success "Binary found in PATH"
  fi

  # Try to run version command
  if "$INSTALL_PATH" --version >/dev/null 2>&1; then
    VERSION_OUTPUT=$("$INSTALL_PATH" --version 2>&1)
    log_success "Verification passed: $VERSION_OUTPUT"
  else
    log_warning "Could not verify binary (might work after adding to PATH)"
  fi
}

# ------------------------------------------------------------------------------
# Print Summary
# ------------------------------------------------------------------------------

print_summary() {
  if [ "$SKIP_BINARY" = true ]; then
    log_step "Configuration Complete! 🎉"

    echo ""
    echo -e "${BOLD}Configuration:${NC}"
    echo -e "  Config:       ${BLUE}$AGENT_DIR/config.json${NC}"
    echo -e "  Hooks:        ${BLUE}.agent/hooks.ts${NC}"
    echo -e "  Settings:     ${BLUE}.claude/settings.json${NC}"
    echo -e "  API URL:      ${BLUE}${CONFIG_BASE_URL}/api${NC}"
    echo -e "  Origin:       ${BLUE}$ORIGIN${NC}"

    echo ""
    echo -e "${BOLD}Installation Summary:${NC}"
    echo -e "  ${GREEN}✓${NC} Project configuration created"
    echo -e "  ${GREEN}✓${NC} Hooks script installed"
    echo -e "  ${GREEN}✓${NC} Claude Code integration configured"

    echo ""
    echo -e "${BOLD}Note:${NC}"
    echo -e "  Binary installation was skipped (--skip-binary flag)"
    echo -e "  Make sure the Agios CLI binary is already installed"
    echo -e "  ${YELLOW}Restart Claude Code${NC} to activate hooks"

    echo ""
    echo -e "${BOLD}Next Steps:${NC}"
    echo -e "  1. Run: ${GREEN}agios --version${NC}"
    echo -e "  2. Run: ${GREEN}agios --help${NC}"
    echo -e "  3. Start tracking: ${GREEN}agios init${NC}"

    echo ""
  else
    log_step "Installation Complete! 🎉"

    echo ""
    echo -e "${BOLD}Configuration:${NC}"
    echo -e "  Platform:     ${BLUE}$OS_NAME ($ARCH_NAME)${NC}"
    echo -e "  Binary:       ${BLUE}$INSTALL_PATH${NC}"
    echo -e "  Config:       ${BLUE}$AGENT_DIR/config.json${NC}"
    echo -e "  Hooks:        ${BLUE}.agent/hooks.ts${NC}"
    echo -e "  Settings:     ${BLUE}.claude/settings.json${NC}"
    echo -e "  API URL:      ${BLUE}${CONFIG_BASE_URL}/api${NC}"
    echo -e "  Origin:       ${BLUE}$ORIGIN${NC}"

    echo ""
    echo -e "${BOLD}Installation Summary:${NC}"
    echo -e "  ${GREEN}✓${NC} Binary installed"
    echo -e "  ${GREEN}✓${NC} Project configuration created"
    echo -e "  ${GREEN}✓${NC} Hooks script installed"
    echo -e "  ${GREEN}✓${NC} Claude Code integration configured"

    echo ""
    echo -e "${BOLD}Next Steps:${NC}"
    echo -e "  1. Run: ${GREEN}agios --version${NC}"
    echo -e "  2. Run: ${GREEN}agios --help${NC}"
    echo -e "  3. Start tracking: ${GREEN}cd your-project && agios init${NC}"
    echo -e "  4. ${YELLOW}Restart Claude Code${NC} to activate hooks"

    if ! command -v agios >/dev/null 2>&1; then
      echo ""
      echo -e "${YELLOW}Remember to add $INSTALL_DIR to your PATH!${NC}"
    fi

    echo ""
  fi
}

# ------------------------------------------------------------------------------
# Main Installation Flow
# ------------------------------------------------------------------------------

main() {
  # Fetch version from manifest early for banner
  INSTALLER_VERSION="unknown"
  if command -v curl &> /dev/null; then
    MANIFEST_URL="${BASE_URL:-http://localhost:5173}/bin/manifest.json"
    INSTALLER_VERSION=$(curl -fsSL "$MANIFEST_URL" 2>/dev/null | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    if [ -z "$INSTALLER_VERSION" ]; then
      INSTALLER_VERSION="unknown"
    fi
  fi

  echo ""
  echo -e "${BOLD}╔════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║   Agios CLI Installer v${INSTALLER_VERSION}$(printf '%*s' $((16 - ${#INSTALLER_VERSION})) '')║${NC}"
  echo -e "${BOLD}╚════════════════════════════════════════╝${NC}"
  echo ""

  check_requirements
  detect_origin

  # Binary installation (skip if --skip-binary flag provided)
  if [ "$SKIP_BINARY" = true ]; then
    log_step "Skipping binary installation"
    log_info "Using --skip-binary flag"
    log_success "Will only create/update project configuration"
  else
    detect_platform
    download_binary
    install_binary
    verify_installation
  fi

  # Always create/update project configuration
  create_config

  # Copy hooks script and configure Claude Code
  copy_hooks_script
  configure_claude_hooks

  print_summary
}

# Run main installation
main "$@"
