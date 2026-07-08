#!/usr/bin/env bash
# Runs ON the water-atlas VM (installed by deploy/setup-autodeploy.sh, fired by a
# systemd timer). Polls GitHub main; when the SHA moves, pulls, rebuilds the site,
# and syncs it into /srv/site — Caddy picks the new files up immediately.
#
# No secrets involved: the repo is public, so a plain https ls-remote/fetch works.
# Overlap-safe without a lockfile: the systemd timer re-arms only after the
# previous run of the oneshot service finishes (OnUnitInactiveSec).
set -euo pipefail

REPO_URL="https://github.com/orbitalfoundation/water-atlas.git"
BRANCH="main"
BASE="/srv/autodeploy"
REPO="$BASE/repo"
STATE="$BASE/deployed-sha"
DEST="/srv/site"

remote_sha="$(git ls-remote "$REPO_URL" "refs/heads/$BRANCH" | cut -f1)"
[ -n "$remote_sha" ] || { echo "could not read $BRANCH from $REPO_URL"; exit 1; }
deployed="$(cat "$STATE" 2>/dev/null || echo none)"
[ "$remote_sha" = "$deployed" ] && exit 0   # nothing new — the common case

echo "› main moved: $deployed -> $remote_sha"

if [ ! -d "$REPO/.git" ]; then
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$REPO"
fi
git -C "$REPO" fetch --depth 1 origin "$BRANCH"
git -C "$REPO" reset --hard FETCH_HEAD
git -C "$REPO" clean -fd   # drop stray files but keep ignored ones (data/, node_modules/)

cd "$REPO"

# data/water.db is gitignored (regenerable via `npm run aggregate -- --all`).
# setup-autodeploy.sh seeds a copy at $BASE/seed-water.db; adopt it on first run.
if [ ! -f data/water.db ]; then
  [ -f "$BASE/seed-water.db" ] || { echo "no data/water.db and no seed — run the aggregator once"; exit 1; }
  mkdir -p data && cp "$BASE/seed-water.db" data/water.db
fi

echo "› npm install (site)"
npm --prefix site ci --no-audit --no-fund

echo "› export + build"
npm run export
npm --prefix site run build

echo "› sync -> $DEST"
rsync -a --delete site/dist/ "$DEST"/

echo "$remote_sha" > "$STATE"
echo "✓ deployed $remote_sha"
