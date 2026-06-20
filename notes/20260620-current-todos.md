# Water Atlas — Current TODOs (priority order)

**Date:** 2026-06-20
**Status:** v1 shipped end-to-end (gauges + reservoirs + water-rights points). This note sets
the next moves in priority order. Companion to
[20260619-architecture.md](20260619-architecture.md) (how it's built) and
[20260619-initial-survey.md](20260619-initial-survey.md) (what data exists).

**Progress (2026-06-20):**
- **P0 deploy** — VM created + site deployed and serving on the box (Caddy in Docker, :8000,
  `https://water-atlas.exe.xyz`). Done via the HTTPS API (`new`) + VM SSH (`exedev@…`, works from
  anywhere). Scripts finalized: `deploy/{provision,deploy}.sh`, `Caddyfile`, `DEPLOYMENT.md`.
  **One step left, manual:** make the VM public — `ssh exe.dev share port water-atlas 8000` +
  `share set-public water-atlas` from the user's own Terminal (scoped API token can't `share`;
  control-plane gateway SSH hangs from sandboxes). Until then the public URL 307s to login.
  Rationale captured: exe.dev (not a CDN) fits because the project will run the aggregator on a
  cron beside the site (live state).
- **P5 FAQ/About** — DONE. `site/src/lib/Faq.svelte` (sectioned accordion), wired into
  `App.svelte`, opened from Sidebar "FAQ" button + a Splash link. Builds + serves clean.

---

## The shape of what's left

Two threads run in parallel:

- **Make it public** — deploy + an About/FAQ so a stranger lands on something self-explanatory.
- **Make it deeper** — the data layers that turn a dot map into the *paper-water-vs-wet-water* story.

The ordering below interleaves them: ship the working thing first (cheap, unblocks sharing),
then add the headline data layer, then breadth. Each item lists **why / effort / how / open Qs**
so any of them is pick-up-able cold.

> Tension worth naming: you said "do the CKAN join first" *and* "deployment is high priority,
> ASAP." Those don't conflict if we read **deploy** as ~half a day of nearly-free work on a thing
> that already works, and **CKAN** as the first real feature. So: deploy v1 now, enrich next.
> If you'd rather the public's first look already has owner/amount on the rights layer, swap P0↔P1.

---

## P0 — Deploy v1 to exe.dev  ·  *high value, low effort*

**Why:** the atlas works *today*. The whole ethos is "rebuildable, durable, public." A live URL is
the difference between a repo and an atlas. Cost is low — we've done this exact dance twice this
month ([open-cubed](/Volumes/summer/projects/2026/open-cubed),
[intotheblue](/Volumes/summer/projects/2026/intotheblue)).

**What we're shipping:** `site/` is a plain **Vite SPA** (not SvelteKit) → `vite build` emits
`site/dist/`. The exported GeoJSON lives in `site/static/data/*` and is copied to `dist/data/*`.
Total payload ≈ **15 MB** (13 MB is `waterrights.geojson`). Small enough to ship inside the build;
Caddy's `encode gzip zstd` cuts the rights layer to ~3–4 MB on the wire. No separate data mount
needed yet (revisit if/when PMTiles lands — see P4).

**How (mirrors intotheblue's `deploy/`):**
1. `water-atlas/deploy/Caddyfile` — serve `/srv/site` on `:80`, `encode gzip zstd`,
   `try_files {path} /index.html` for the SPA, hard cache on `/assets/*` (Vite fingerprints them).
2. `water-atlas/deploy/provision.sh <vm>` — `ssh exe.dev new --name water-atlas`, upload Caddyfile,
   `docker run` Caddy bind-mounting `/srv/site`, `ssh exe.dev share port <vm> 8080` +
   `share set-public`.
3. `water-atlas/deploy/deploy.sh <vm>` — `npm run export` (refresh data) → `npm --prefix site run
   build` → `rsync -avh --delete site/dist/ <vm>.exe.xyz:/srv/site/`. Idempotent; run every update.
4. Verify at `https://water-atlas.exe.xyz`.

**Open Qs:**
- Custom domain? (intotheblue did Cloudflare CNAME → exe.dev `domain add`.) Is there a name we want
  — e.g. `californiawater.atlas`-ish? Decide before announcing.
- Data freshness: ship a periodic refresh (cron / GitHub Action runs `aggregate --all && export &&
  deploy`) so the map doesn't go stale? Low priority but on-brand for "durable."

---

## P1 — eWRIMS CKAN join: face value, owner, status  ·  *highest feature value*

**Why:** this is the project's whole thesis. Right now `waterrights.geojson` is **locations only** —
64k dots with no amount, owner, or status. The numbers that make "California granted ~5× the water
that flows" *visible* live in the CKAN tabular mirror, joinable by **`APPL_ID`**. This turns the
headline layer from "where" into "how much / who / is it active."

**How:**
- Source: `data.ca.gov` / `data.cnra.ca.gov` CKAN `datastore_search` for the eWRIMS rights/use
  tables; join to the existing POD features by `APPL_ID`.
- Likely the right shape is a **new observation/props enrichment pass**, not a new layer: keep the
  same points, fold in `face_value_af`, `owner`, `status`, `priority_date`, `use_type` as props
  (and/or observations where a value is time-like).
- Update the exporter's `exportProps` for the rights layer + the popup template in `lib/map.js`.
- Consider a derived per-point or per-watershed **paper-vs-wet** ratio once amounts exist —
  that's the money visual (rights face value vs nearby gauge flow / reservoir storage).

**Open Qs:**
- Exact CKAN `resource_id`(s) for the rights *amounts* table — verify live and pin in the survey
  note (we only confirmed the POD FeatureServer + that the join is by `APPL_ID`).
- Coverage: what fraction of 64k PODs actually join? Surface unmatched count honestly.
- Units / face-value semantics (AF/yr? diversion vs storage rights?) — get this right; it's the
  number everything else argues from.

---

## P2 — US Drought Monitor  ·  *liveliness, and our first polygon layer*

**Why:** instant, real-time context that makes the map feel *alive* — weekly drought polygons
colored by severity (`DM` 0–4) behind the points. Also strategically useful: it forces the
**first non-point (polygon) path** through the exporter + `lib/map.js`, which we'll reuse for
groundwater basins, watersheds, etc.

**How:**
- One GeoJSON call (verified live, see survey §3):
  `https://services5.arcgis.com/0OTVzJS4K09zlixn/arcgis/rest/services/USDM_current/FeatureServer/0/query?where=1=1&outFields=*&f=geojson`
- New source file `aggregator/sources/us-drought.js`. Needs the data model to carry a polygon
  geometry — today `features` stores lat/lon points only. Decide: add a `geometry` (GeoJSON blob)
  column, or a parallel `feature_geometries` table. **Smallest change that stays generic wins.**
- Exporter: emit Polygon features; manifest `style.kind: 'fill'` with a `DM`→color ramp.
- `lib/map.js`: add a `fill` layer branch alongside the existing point/cluster branches.

**Open Qs:**
- Polygon storage shape (above) — this is the one real design decision; gets reused.
- Refresh cadence: USDM updates weekly (Thursdays). Tie into the P0 refresh job.

---

## P3 — CA groundwater (SGMA / periodic levels)  ·  *the Videmsky layer, modernized*

**Why:** groundwater levels were one of the original atlas's three headline layers. Subsidence in
the Central Valley is one of the most dramatic water stories in the state. Heavier (time-series
across ~47k stations) but high meaning.

**How:**
- CNRA CKAN (survey §3): stations `resource_id=af157380-fb42-4abf-b72a-6f9f98868077`,
  measurements `resource_id=bfa9f262-24a1-45bd-8dc8-138bc8107266`, join by `site_code`.
- 6.3M measurements — do **not** pull all of it. Strategy: stations as features; pull *latest* (or
  latest-per-year) level per station as observations. Lean on the watermark/incremental machinery.
- Natural fit for the existing `observations` table + "fold latest value into the map point" export.

**Open Qs:**
- Which metric to surface: depth-to-water, water-surface elevation, or change-over-time? The
  *change* (decline) is the story, but needs ≥2 timepoints per station.
- Volume control: cap timepoints per station so the DB/export stay sane.

---

## P4 — Performance: PMTiles / vector tiles for dense layers  ·  *value real, labor uncertain*

**Why:** `waterrights.geojson` is 13 MB; groundwater would add more. Fine on localhost with
clustering, not ideal for a public site on a phone.

**Honest labor read (you flagged uncertainty — here it is):**
- Full PMTiles path = install `tippecanoe` (or equivalent) to bake `.pmtiles`, add the `pmtiles://`
  protocol to MapLibre, change the exporter to emit tiles, host the `.pmtiles` file. **Medium**
  effort + a new build dependency. Worth it eventually; not urgent.
- **Cheaper interim wins to try first** (may make PMTiles unnecessary for a while):
  - Caddy `encode gzip zstd` already ~3–4×'s the rights layer on the wire (free, comes with P0).
  - Trim `exportProps` + round coordinate precision (6 dp) → smaller files.
  - Keep clustering (already in `lib/map.js`).
- **Recommendation:** ship P0 with gzip, *measure* real load on a phone, and only commit to
  PMTiles if it's actually slow. Don't pay the labor on spec.

**Open Q:** is `tippecanoe` acceptable as a dev-time dependency given the "no native deps / rebuild
from clone" ethos? If not, server-side bbox queries are the alternative (but that reintroduces a
backend, which we deliberately don't have).

---

## P5 — About / FAQ page  ·  *ship alongside P0 (going public needs a "what is this")*

A stranger landing on the live site needs the *why*, not just the map. You brainstormed a rich set
of topics — here's a proposed sectioning. (The `Splash.svelte` intro already gestures at some of
this; the FAQ is the deeper read.) Treat each bullet as a question to answer in 2–4 sentences.

**1. What is this & where did it come from**
- The New California Water Atlas (≈2012–2014): Laci Videmsky / Resource Renewal Institute, advisors
  Huey Johnson & Stewart Brand; revived a 1979 printed state atlas. (Longnow writeup.)
- Why revive it: the original went offline (link rot) — which is *itself* the argument for a
  durable, open, rebuild-from-`git-clone` version.

**2. Why this matters**
- Water is intersectional — it touches agriculture, cities, ecology, climate, equity, law. A good
  lens precisely because it connects so many lives.
- The paper-vs-wet-water gap: ~5× more rights granted than water that flows. Making that legible is
  civic infrastructure.

**3. Why a web app at all — why not just QGIS / ArcGIS?**
- Civic transparency & engagement: a public URL anyone opens beats a desktop GIS file a handful of
  analysts can load. The audience is citizens, not GIS operators.
- But argue it honestly: yes, you *could* use QGIS, ArcGIS Online, kepler.gl, Felt, etc. with a
  client renderer. Trade-offs: those are powerful but either proprietary, account-walled, or not
  durably self-hostable. Our bet is small + open + rebuildable over feature-rich + dependent.
- Note what we deliberately *don't* do (no backend, no accounts) and why that buys durability.

**4. How it's built / how tools like Claude change the economics**
- Built from public APIs → SQLite → static GeoJSON → MapLibre, by a tiny team.
- AI-assisted development collapses the labor of plumbing (API spelunking, schema design, glue,
  copy) so the scarce human effort goes to *judgment and storytelling*. Worth being concrete and
  non-hypey: what actually got faster.

**5. Stakeholders**
- Who cares / who's affected: farmers & water districts, cities & utilities, tribes, environmental
  & fishery interests, regulators (State Water Board, DWR), researchers, journalists, the public.
- Whose data this is (and the licenses: US public domain for USGS, CA open data for CDEC/eWRIMS).

**6. How to use the app**
- Toggling layers, reading the popups (gauge → flow, reservoir → % full, right → amount/owner once
  P1 lands), what the colors mean, data freshness/caveats.

**Open Q:** one long FAQ page vs. an `/about` route + inline tooltips? For a no-router SPA, simplest
is a scrollable panel/modal. Decide when we build it.

---

## Quick reference — priority at a glance

| P | Item | Value | Effort | Blocks / pairs with |
|---|------|-------|--------|---------------------|
| 0 | Deploy v1 to exe.dev | High | Low | pairs with P5 |
| 1 | eWRIMS CKAN join (amount/owner/status) | Highest feature | Medium | the thesis |
| 2 | US Drought Monitor | High (liveliness) | Low–Med | builds polygon path for P3 |
| 3 | CA groundwater (SGMA) | High | Med–High | uses P2's polygon work |
| 4 | PMTiles / perf | Real but deferrable | Med (uncertain) | measure first |
| 5 | About / FAQ | High for public | Low–Med | ship with P0 |

## Open questions to settle (cross-cutting)
- [ ] Custom domain for the deploy? (name + Cloudflare/exe.dev setup)
- [ ] Automated refresh job (cron/Action: aggregate → export → deploy)?
- [ ] Polygon storage shape in the data model (P2) — the one reused design decision.
- [ ] CKAN `resource_id`s + join coverage for rights amounts (P1).
- [ ] Is `tippecanoe` an acceptable dev dependency (P4)?
