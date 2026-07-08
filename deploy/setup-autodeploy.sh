#!/usr/bin/env bash
# One-time installer for on-VM continuous deployment. Run from the repo root on
# your laptop:   deploy/setup-autodeploy.sh [vm-name]
#
# After this, the VM itself polls GitHub main every ~2 minutes and — whenever the
# SHA changes — pulls, rebuilds (export + vite), and syncs into /srv/site. Pushing
# to main IS the deploy; deploy/deploy.sh remains as a manual override.
#
# What it does on the VM:
#   1. installs Node 22 (node:sqlite needs >= 22.5), git, rsync
#   2. creates /srv/autodeploy, uploads autodeploy.sh, seeds data/water.db
#      (gitignored, so the VM can't get it from the clone)
#   3. installs + enables a systemd oneshot service and timer
set -euo pipefail

VM="${1:-${VM:-water-atlas}}"
HOST="$VM.exe.xyz"
DEST="exedev@$HOST"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=5 -o ServerAliveCountMax=3)
SSH() { ssh "${SSH_OPTS[@]}" "$DEST" "$@"; }

[ -f "$ROOT/data/water.db" ] || { echo "no local data/water.db — run 'npm run aggregate -- --all' first"; exit 1; }

echo "› installing Node 22 + git + rsync on $HOST"
SSH 'node -e "process.exit(+process.versions.node.split(\".\")[0] >= 22 ? 0 : 1)" 2>/dev/null || {
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - &&
  sudo apt-get install -y nodejs; }'
SSH 'sudo apt-get install -y -q git rsync'

echo "› creating /srv/autodeploy and uploading the deployer + seed database"
SSH 'sudo mkdir -p /srv/autodeploy && sudo chown exedev:exedev /srv/autodeploy'
rsync -e "ssh ${SSH_OPTS[*]}" -avh "$ROOT/deploy/autodeploy.sh" "$DEST:/srv/autodeploy/autodeploy.sh"
rsync -e "ssh ${SSH_OPTS[*]}" -avh "$ROOT/data/water.db" "$DEST:/srv/autodeploy/seed-water.db"
SSH 'chmod +x /srv/autodeploy/autodeploy.sh'

echo "› installing systemd service + timer"
SSH 'sudo tee /etc/systemd/system/water-atlas-autodeploy.service >/dev/null' <<'UNIT'
[Unit]
Description=Water Atlas — rebuild + redeploy when GitHub main changes
After=network-online.target

[Service]
Type=oneshot
User=exedev
ExecStart=/srv/autodeploy/autodeploy.sh
UNIT

# OnUnitInactiveSec re-arms only after the previous run finishes, so a slow
# build can never overlap the next poll.
SSH 'sudo tee /etc/systemd/system/water-atlas-autodeploy.timer >/dev/null' <<'UNIT'
[Unit]
Description=Poll GitHub main for Water Atlas deploys

[Timer]
OnBootSec=2min
OnUnitInactiveSec=2min

[Install]
WantedBy=timers.target
UNIT

SSH 'sudo systemctl daemon-reload && sudo systemctl enable --now water-atlas-autodeploy.timer'

echo "› first run (deploys current main now)"
SSH 'sudo systemctl start water-atlas-autodeploy.service'
SSH 'systemctl status water-atlas-autodeploy.timer --no-pager -l | head -6'

echo "✓ auto-deploy installed. Watch it with:"
echo "    ssh $DEST journalctl -u water-atlas-autodeploy -f"
