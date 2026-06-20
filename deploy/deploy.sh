#!/usr/bin/env bash
# Build the Water Atlas site and push it to its exe.dev VM. Run for every update.
# Re-exports GeoJSON from the local SQLite, builds the static site, and rsyncs
# site/dist/ to the VM. Caddy serves the new files immediately (no restart).
# Usage: deploy/deploy.sh <vm-name>         (default vm: water-atlas)
set -euo pipefail

VM="${1:-${VM:-water-atlas}}"
HOST="$VM.exe.xyz"
DEST="exedev@$HOST"                 # login user on exe.dev VMs is always 'exedev'
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Self-contained SSH opts (work without ~/.ssh/config): tolerate the VM host key
# changing on reprovision, and fail fast instead of hanging forever.
SSH="ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=5 -o ServerAliveCountMax=3"

echo "› exporting GeoJSON from data/water.db"
( cd "$ROOT" && npm run export )

echo "› building site"
( cd "$ROOT" && npm --prefix site run build )

echo "› syncing site/dist/ → $HOST:/srv/site"
# --delete removes stale files (e.g. old fingerprinted assets).
rsync -avh --delete -e "$SSH" "$ROOT/site/dist/" "$DEST:/srv/site/"

echo "✓ deployed → https://$HOST"
