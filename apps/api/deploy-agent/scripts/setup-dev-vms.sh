#!/bin/bash
# setup-dev-vms.sh — One-time setup for OrbStack dev VMs
# Run this from the Mac Studio to prepare VMs for auto-provisioning.
#
# Prerequisites:
#   - OrbStack running with dev-inkwell, dev-grwthfn, dev-general VMs
#   - ~/.ssh/id_ed25519_automation key available on Mac Studio
#
# Usage: ./setup-dev-vms.sh

set -euo pipefail

DEPLOY_HOST="172.232.188.216"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

for VM in dev-inkwell dev-grwthfn dev-general; do
  echo "=== Setting up ${VM} ==="

  # Install required tools
  ssh dev@${VM}@orb << 'EOF'
    sudo apt-get update -qq
    sudo apt-get install -y -qq jq rsync git curl > /dev/null

    # Install bun if not present
    if ! command -v bun &> /dev/null; then
      echo "Installing bun..."
      curl -fsSL https://bun.sh/install | bash
      echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
      echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
    fi

    # Create provision directory
    mkdir -p ~/.provision ~/.ssh
    chmod 700 ~/.ssh
EOF

  # Copy Linode deploy key
  scp ~/.ssh/id_ed25519_automation dev@${VM}@orb:~/.ssh/id_ed25519_automation
  ssh dev@${VM}@orb "chmod 600 ~/.ssh/id_ed25519_automation"

  # Add Linode to known_hosts
  ssh dev@${VM}@orb "ssh-keyscan -t ed25519 ${DEPLOY_HOST} >> ~/.ssh/known_hosts 2>/dev/null"

  # Copy provision script
  scp "${SCRIPT_DIR}/provision-workspace.sh" dev@${VM}@orb:~/.provision/provision-workspace.sh
  ssh dev@${VM}@orb "chmod +x ~/.provision/provision-workspace.sh"

  echo "=== ${VM} ready ==="
done

echo ""
echo "All VMs configured. Deploy key and provision script installed."
echo "VMs will auto-provision apps on next terminal session."
