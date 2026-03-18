#!/bin/bash
# orbstack-terminal.sh — SSH→OrbStack VM terminal wrapper
# Uses OrbStack's native SSH proxy (dev@VM@orb) to avoid .orb.local
# which hangs at key exchange in non-interactive SSH sessions.
#
# Chain: Linode → SSH Mac Studio → ssh dev@<vm>@orb → provision → tmux
#
# Usage: orbstack-terminal.sh <vm-name> <work-dir> <cols> <rows> [apps-base64]

VM_NAME="$1"
WORK_DIR="$2"
COLS="$3"
ROWS="$4"
APPS_B64="${5:-W10=}"  # Default: base64("[]")

HOST="${ORBSTACK_SSH_HOST:-100.74.69.40}"
USER="${ORBSTACK_SSH_USER:-hgeldenhuys}"
KEY="${ORBSTACK_SSH_KEY:-/home/deploy/.ssh/id_ed25519_orbstack}"

# Set the socat PTY size before SSH — SSH propagates this through the chain
stty rows "${ROWS}" cols "${COLS}" 2>/dev/null

# SSH to Mac Studio, then SSH into the OrbStack VM via native proxy
# as the isolated 'dev' user (no macOS filesystem access).
# Runs provision-workspace.sh (if present) before starting tmux.
exec ssh -tt \
  -i "${KEY}" \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=accept-new \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  "${USER}@${HOST}" \
  "ssh -tt dev@${VM_NAME}@orb 'stty rows ${ROWS} cols ${COLS} 2>/dev/null; if [ -x /home/dev/.provision/provision-workspace.sh ]; then /home/dev/.provision/provision-workspace.sh ${APPS_B64}; fi && cd ${WORK_DIR} && TERM=screen-256color COLUMNS=${COLS} LINES=${ROWS} tmux new-session -A -s main'"
