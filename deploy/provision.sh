#!/usr/bin/env bash
# One-time provisioning for the Water Atlas VM on exe.dev. Idempotent — safe to
# re-run; it just (re)starts Caddy. Creating the VM and making it PUBLIC are
# separate steps (see deploy/DEPLOYMENT.md): the scoped API token can't share,
# and the control-plane gateway SSH often hangs, so do those out-of-band.
# Usage: deploy/provision.sh <vm-name>      (default vm: water-atlas)
set -euo pipefail

VM="${1:-${VM:-water-atlas}}"
HOST="$VM.exe.xyz"
DEST="exedev@$HOST"                 # login user on exe.dev VMs is always 'exedev'
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8000}"               # VMs default to proxy_port 8000 (see `new` output)

# Self-contained SSH opts (work without ~/.ssh/config): tolerate the VM host key
# changing on reprovision, and fail fast (~15s) instead of hanging forever.
SSH="ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=5 -o ServerAliveCountMax=3"

echo "› ensuring /srv on $HOST"
$SSH "$DEST" 'sudo mkdir -p /srv/site && sudo chown -R "$(id -un)":"$(id -gn)" /srv'

echo "› uploading Caddyfile"
rsync -e "$SSH" "$HERE/Caddyfile" "$DEST:/srv/Caddyfile"

echo "› enabling docker at boot + (re)starting Caddy on :$PORT"
$SSH "$DEST" "sudo systemctl enable --now docker >/dev/null 2>&1; \
  docker rm -f water-atlas 2>/dev/null || true; \
  docker run -d --name water-atlas --restart unless-stopped \
    -p $PORT:80 \
    -v /srv/site:/srv/site:ro \
    -v /srv/Caddyfile:/etc/caddy/Caddyfile:ro \
    caddy:2"

cat <<EOF
✓ provisioned ($HOST). The VM is PRIVATE until you make it public.
  The scoped API token can't 'share'; gateway SSH may hang. From your own
  Terminal (keepalives turn a hang into a ~15s failure):
    ssh exe.dev share port $VM $PORT
    ssh exe.dev share set-public $VM
  …or do it via the exe.dev dashboard. Then run deploy/deploy.sh $VM.
EOF
