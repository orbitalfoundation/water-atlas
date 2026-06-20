# Water Atlas — deployment reference

Audience: humans **and** Claude instances deploying this project. The exhaustive
exe.dev model, quirks, and recovery runbook live in a sibling project's doc:
**`/Volumes/summer/projects/2026/intotheblue/deploy/DEPLOYMENT.md`** — read that
for the deep dive. This file records the **Water-Atlas-specific** facts and the
exact path that worked on 2026-06-20.

---

## Why exe.dev for *this* project (not a CDN)

For a purely static site, a CDN host (Cloudflare Pages / Netlify / GitHub Pages)
is usually the better call — global, redundant, atomic deploys, free. The build
here is static and **will** run on any of those (see [README.md](README.md)).

But Water Atlas has **live state**: the whole point is fresh water data. The
roadmap (notes/20260620-current-todos.md) includes a periodic refresh —
`aggregate → export → rebuild` on a schedule. That wants a *real server* with
cron, a filesystem, and the Node aggregator, not just a file host. A single
exe.dev VM gives us that in one box: serve the static site **and** run the
collector on a timer beside it. So exe.dev is the right primary target here.

> Durability caveat (inherited from the exe.dev model): one VM, one region
> (`lax`), one disk, no documented backups. Source of truth stays in git + the
> public APIs — the VM is reproducible, not precious. `data/water.db` is
> regenerable via `npm run aggregate -- --all`.

## What's deployed

- **VM:** `water-atlas` (Ubuntu/exeuntu, 2 vCPU / 8 GB / region `lax`), login
  user `exedev`. Created via the HTTPS API (`new --name water-atlas`).
- **Serving:** a `caddy:2` Docker container named `water-atlas`, `-p 8000:80`,
  bind-mounting `/srv/site` (the build) and `/srv/Caddyfile` read-only.
  Port **8000** matches the VM's default `proxy_port`.
- **URL:** https://water-atlas.exe.xyz (public after the `share set-public` step).

## The path that worked (2026-06-20)

Control-plane over the **HTTPS API** (gateway SSH hangs from sandboxes; the API
doesn't). Token in `deploy/.api-token` (git-ignored). The token is **scoped** —
it allows `ls`, `whoami`, `new`, `help`, but **not** `share` /
`generate-api-key` / `browser`.

```sh
TOKEN=$(tr -d '[:space:]' < deploy/.api-token)
API() { curl -sS -X POST https://exe.dev/exec -H "Authorization: Bearer $TOKEN" -d "$1"; }

API 'whoami'                 # confirm your key is registered (id_exe = "exe-dev-key")
API 'new --name water-atlas' # create the VM (returns https_url + proxy_port 8000)

deploy/provision.sh water-atlas   # /srv, Caddyfile, enable docker, run Caddy :8000
deploy/deploy.sh   water-atlas    # export + build + rsync site/dist → /srv/site
```

VM SSH (`ssh exedev@water-atlas.exe.xyz`) works fine from anywhere, including
sandboxes — that's what `provision.sh`/`deploy.sh` use.

## The one manual step: make it public

`share` is **not** in the scoped token, and the control-plane gateway SSH
(`ssh exe.dev …`) hangs (a known quirk — even with a registered key). So flip the
VM public **out-of-band**, from your own Terminal or the dashboard:

```sh
# from your own Terminal (keepalives turn a hang into a ~15s failure):
ssh -o ServerAliveInterval=5 -o ServerAliveCountMax=3 exe.dev share port water-atlas 8000
ssh -o ServerAliveInterval=5 -o ServerAliveCountMax=3 exe.dev share set-public water-atlas
```

If gateway SSH also hangs for you, use the dashboard: `ssh exe.dev browser`
(or any authenticated session / a broader API token) → open the VM → make the
HTTP proxy public. A **private** VM answers the public URL with a `307 →
/__exe.dev/login` redirect; once public it serves the site.

## Verify

```sh
curl -sS -o /dev/null -w "%{http_code}\n" https://water-atlas.exe.xyz/        # 200 when public
ssh exedev@water-atlas.exe.xyz 'curl -s -o /dev/null -w "%{http_code}\n" localhost:8000/'  # always 200 if Caddy is up
```

## Quick recovery

- **Site 502 / down after reboot:** `ssh exedev@water-atlas.exe.xyz 'sudo systemctl enable --now docker; docker start water-atlas'`
- **`Host key verification failed`:** VM was reprovisioned — scripts already pass
  `accept-new`/`UserKnownHostsFile=/dev/null`; manual fix `ssh-keygen -R water-atlas.exe.xyz`.
- **Deploy/gateway SSH hangs forever:** you forgot keepalives, or it's the
  gateway quirk — use the HTTPS API for control-plane, VM SSH for the box.
- **VM gone:** `API 'new --name water-atlas'` → `provision.sh` → `deploy.sh` →
  re-run the public step. `npm run aggregate -- --all` rebuilds the data.
