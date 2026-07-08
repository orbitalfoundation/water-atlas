# Deploying Water Atlas to exe.dev

> **New here, or a deploy is failing?** Read **[DEPLOYMENT.md](DEPLOYMENT.md)**
> first — it records what actually worked, the scoped-token / hanging-gateway
> quirks, the one manual "make it public" step, and a recovery runbook. The deep
> exe.dev model lives in the sibling project
> `/Volumes/summer/projects/2026/intotheblue/deploy/DEPLOYMENT.md`. This file is
> the happy-path command sequence.

> **exe.dev is just one host, not a requirement.** The site is plain static files
> (`site/dist/` — HTML, JS, CSS, GeoJSON). It will run on anything that serves
> static files: GitHub Pages, Netlify, Cloudflare Pages, S3 + CloudFront, Vercel,
> a plain nginx/Caddy box, even `python3 -m http.server` for a local look. The one
> requirement is that `/data/*.geojson` is served alongside `index.html`. We use
> exe.dev here because it's our standard durable target and matches our other
> projects, but nothing in the app is coupled to it. To move hosts, just point
> their static-build step at `site/dist/` (build cmd `npm --prefix site run build`).

The site is a static Vite SPA (`site/dist/`, ~1 MB JS + ~15 MB exported GeoJSON).
exe.dev terminates TLS at its proxy; the VM runs Caddy in Docker serving plain
HTTP, which exe.dev exposes publicly. Caddy gzips the data on the wire, so the
13 MB rights layer ships as ~3–4 MB.

```
local site/dist  ──rsync──▶  VM:/srv/site  ──▶  Caddy (Docker) ──▶ exe.dev proxy ──▶ https://water-atlas.exe.xyz
```

## 0. Prerequisites — SSH key setup (one time)

exe.dev authenticates by SSH key. Docs: <https://exe.dev/docs/cli-ssh-key>.

**Generate a key for this laptop** (mnemonic comment, no passphrase so deploy
scripts run unattended):

```sh
ssh-keygen -t ed25519 -C "anselm@<laptop>-exe" -f ~/.ssh/id_exe_<laptop> -N ""
```

**Pin it in `~/.ssh/config`** so exe.dev and every VM use it:

```
Host exe.dev
    HostName exe.dev
    IdentityFile ~/.ssh/id_exe_<laptop>
    IdentitiesOnly yes

Host *.exe.xyz
    IdentityFile ~/.ssh/id_exe_<laptop>
    IdentitiesOnly yes
```

**Register the public key.** Two ways:

- If you already have working SSH access from any machine:
  ```sh
  cat ~/.ssh/id_exe_<laptop>.pub | ssh exe.dev ssh-key add
  ```
- Bootstrapping a brand-new key with no working access yet (chicken-and-egg):
  paste the public key in the **exe.dev web dashboard** → SSH keys → Add.

List / verify registered keys:

```sh
ssh exe.dev ssh-key list
```

> **Troubleshooting a hang.** exe.dev's gateway does **not** cleanly reject an
> unknown key with `Permission denied` — if `~/.ssh/config` forces a key that
> isn't registered (via `IdentitiesOnly yes` + `IdentityFile`), the gateway goes
> silent after the key is offered and the connection **hangs** until
> `Connection ... port 22 timed out`. So a hang almost always means "this config
> is pinning an unregistered key," not a syntax error. Fixes: point the config
> at a key you *have* registered, or register the current one. Confirm which key
> works by bypassing the config:
> ```sh
> ssh -o IdentitiesOnly=yes -i ~/.ssh/id_exe          -o ConnectTimeout=10 exe.dev whoami
> ssh -o IdentitiesOnly=yes -i ~/.ssh/id_exe_nudibranch -o ConnectTimeout=10 exe.dev whoami
> ```
> `ssh -vv exe.dev whoami` shows exactly where it stops. (Separately: SSH from
> inside a sandboxed/agent shell can also stall after the handshake — run deploys
> from a normal Terminal.)

This laptop (`nudibranch`) uses `~/.ssh/id_exe_nudibranch`
(fingerprint `SHA256:ewWvv30iuIuANlNtWCXVoukkJCKTa2js5ZMl34R7MmE`).

## 1. Verify access (one time)

- Confirm from this machine:
  ```sh
  ssh exe.dev whoami      # should print your account
  ```
- The VM needs Docker + rsync (present on the default exe.dev image).

## 2. Create the VM (one time)

```sh
ssh exe.dev new --name water-atlas
```

(Optionally `ssh exe.dev set-region <region>` first.)

## 3. Provision it (one time)

From the repo root:

```sh
deploy/provision.sh water-atlas
```

Uploads the Caddyfile, starts Caddy in Docker (bind-mounting `/srv/site`,
auto-restart on reboot), and exposes it publicly on port 8080.

## 4. Deploy the site (every update)

```sh
deploy/deploy.sh water-atlas
```

Re-exports GeoJSON, builds, and rsyncs `site/dist/`. Verify at
**https://water-atlas.exe.xyz**.

---

## Continuous deployment from GitHub (optional, one time)

Instead of running `deploy/deploy.sh` by hand, the VM can watch GitHub and
redeploy itself — pushing to `main` becomes the deploy:

```sh
deploy/setup-autodeploy.sh water-atlas
```

This installs Node 22 on the VM, seeds it with your local `data/water.db`
(gitignored, so the clone can't provide it), uploads
[autodeploy.sh](autodeploy.sh), and enables a systemd timer that polls
`git ls-remote` on the public repo every ~2 minutes. When the `main` SHA moves,
the VM pulls, runs `npm run export` + `npm --prefix site run build`, and rsyncs
`site/dist/` into `/srv/site` (Caddy serves the new files immediately). No
tokens or webhooks needed — the repo is public and the poll is outbound-only.

> **Note:** running the *installer* is itself a deploy — it builds and ships
> current `main` immediately.

Watch it / check on it:

```sh
ssh exedev@water-atlas.exe.xyz journalctl -u water-atlas-autodeploy -f
ssh exedev@water-atlas.exe.xyz cat /srv/autodeploy/deployed-sha
```

Caveats: only `main` triggers; data freshness still depends on the seeded
`water.db` (a future on-VM timer could re-run `npm run aggregate -- --all`
before rebuilding); `deploy/deploy.sh` still works as a manual override, but
the next push to `main` overwrites whatever it shipped.

## Custom domain (optional, one time)

DNS via Cloudflare → add **DNS-only (grey-cloud, NOT proxied)** CNAMEs for the
apex and `www` pointing at `water-atlas.exe.xyz`, then:

```sh
ssh exe.dev domain add water-atlas <your-domain>
ssh exe.dev domain add water-atlas www.<your-domain>
```

> ⚠️ Must be grey-cloud. Cloudflare's orange-cloud proxy replaces the target
> with Cloudflare IPs and breaks exe.dev's TLS + routing.

exe.dev verifies DNS resolves to the VM, then issues TLS automatically. Until
then requests get `421 Misdirected Request`. Status: `ssh exe.dev domain ls water-atlas`.

## Cheat sheet

| Task                   | Command                                       |
| ---------------------- | --------------------------------------------- |
| Ship an update         | push to `main` (with auto-deploy installed) or `deploy/deploy.sh water-atlas` |
| Install auto-deploy    | `deploy/setup-autodeploy.sh water-atlas`      |
| Auto-deploy logs       | `ssh exedev@water-atlas.exe.xyz journalctl -u water-atlas-autodeploy -f` |
| Restart the web server | `ssh water-atlas.exe.xyz 'docker restart water-atlas'` |
| Tail server logs       | `ssh water-atlas.exe.xyz 'docker logs -f water-atlas'`  |
| VM resource usage      | `ssh exe.dev stat water-atlas`                |
