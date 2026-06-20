# Water Atlas — Architecture & Aggregator Policy

**Date:** 2026-06-19
**Status:** v1 working end-to-end (USGS gauges, CDEC reservoirs, eWRIMS water rights → map)

This note documents how the thing is built and *why*, so it stays revivable. Companion to
[20260619-initial-survey.md](20260619-initial-survey.md) (what data exists) — this is how we move it.

---

## 1. The pipeline

```
 public APIs ──▶ aggregator ──▶ SQLite ──▶ exporter ──▶ GeoJSON ──▶ Svelte + MapLibre
 (USGS/CDEC/    (node, no       (data/      (per-layer    (site/static   (keyless basemap,
  eWRIMS)        deps)          water.db)    + manifest)    /data/*.json)  data-driven UI)
```

Three deliberate seams, each independently runnable and recyclable:

1. **Collect** — `npm run aggregate <source…>` pulls from APIs into SQLite (idempotent, resumable).
2. **Export** — `npm run export` flattens SQLite → static GeoJSON + a `layers.json` manifest.
3. **Serve** — `npm run site` (a static Svelte SPA) renders the manifest on a map. No backend.

A stranger can `git clone`, run three commands, and see live California water. That's the bar.

---

## 2. Directory layout

```
water-atlas/
├── aggregator/
│   ├── cli.js                 # `node cli.js <id…> | --all | --list`
│   ├── export-geojson.js      # SQLite -> site/static/data/*.geojson + layers.json
│   ├── core/                  # reusable machinery (DRY across sources)
│   │   ├── db.js              #   schema + idempotent upsert helpers (node:sqlite)
│   │   ├── http.js            #   throttle + retry/backoff + on-disk cache
│   │   ├── state.js           #   per-source watermark store
│   │   ├── registry.js        #   auto-discovers sources/*.js
│   │   ├── run.js             #   per-source policy wrapper (status, isolation)
│   │   └── log.js             #   tiny stderr logger
│   └── sources/               # one small file per data source (the part you add to)
│       ├── usgs-sites.js
│       ├── cdec-reservoirs.js + cdec-reservoirs.seed.json
│       └── ca-water-rights.js
├── data/                      # water.db + cache/  (gitignored)
├── site/                      # Svelte 5 + Vite + MapLibre (its own package.json)
└── notes/                     # this folder
```

---

## 3. Data model (generic, recyclable)

Three tables. Sources never invent their own schema — they push points + observations.

- **`features`** — one mappable point per `(source, external_id)`. Columns: `layer`, `name`,
  `lat`, `lon`, `props` (JSON blob of source-specific fields), `fetched_at`. PK enforces dedup.
- **`observations`** — time-stamped values on a feature. `(source, feature_external_id, variable,
  observed_at)` PK. `variable` is e.g. `storage_af`, `discharge_cfs`, `swe_in`. This is where the
  *time series* lives; the export folds the latest value per variable into the map point.
- **`source_state`** — per-source `cursor` (watermark), `last_run_at`, `last_status`, `stats`.

Why split features vs observations? Because the interesting layers (reservoirs, gauges) are a stable
point + a changing number. Keeping them separate means re-running only appends new numbers, and one
point can carry many variables later (storage + inflow + temperature) without schema churn.

---

## 4. Aggregator policy (the "be smart about it" requirements)

These are implemented in `core/`, so every source inherits them for free:

| Policy | Where | What it does |
|---|---|---|
| **Idempotent upsert** | `db.js` | `INSERT … ON CONFLICT … DO UPDATE`. Re-runs never duplicate. |
| **Resume, don't restart** | `state.js` + source | Source reads `ctx.cursor`, fetches only newer data, returns a new cursor. *Verified: re-running CDEC fetched 1 day, not 45; row counts held at 966.* |
| **Polite HTTP** | `http.js` | Global throttle (250 ms), exponential backoff + retry on 429/5xx/network, descriptive User-Agent. |
| **Raw cache + provenance** | `http.js` + `fetched_at` | Responses cached on disk by URL hash; every row stamped with fetch time. Slow-changing fetches (CDEC station coords) use `cache:'prefer'`. |
| **Failure isolation** | `run.js` | One source throwing is caught, logged, recorded as `error` in `source_state`; other sources still run. |

**Watermark semantics differ by source shape, intentionally:**
- *Bounded snapshot* (gauges, water rights): re-page the whole set each run; idempotent upsert *is*
  the "don't restart" guarantee. Cheap (seconds).
- *Append-only time series* (CDEC storage): persist the last observed date; next run starts there.
  This is the pattern to reuse for any future month-long backfill.

---

## 5. Adding a source (the extensibility story)

Drop one file in `aggregator/sources/`. It default-exports a descriptor:

```js
export default {
  id: 'my-source',                 // CLI id + source key
  title: 'Human readable',
  layer: 'my-layer',               // groups features; one GeoJSON file per layer
  description: '…',
  style: { color: '#3aa0d1', cluster: false, kind: 'point' },  // optional map hints
  exportProps: ['a', 'b'],         // optional: trim which props reach the GeoJSON

  async run({ store, http, log, cursor }) {
    const data = await http.getJson('https://…');
    for (const d of data) {
      store.feature({ source: 'my-source', layer: 'my-layer', external_id: d.id,
                      name: d.name, lat: d.lat, lon: d.lon, props: { … } });
      store.observation({ source: 'my-source', feature_external_id: d.id,
                          variable: 'something', value: d.v, unit: 'x', observed_at: d.t });
    }
    return { cursor: newWatermark, stats: { count: data.length } };
  },
};
```

`registry.js` auto-discovers it; `cli.js --list` shows it; the exporter + UI pick it up from
`layer`/`style`. No central registration, no wiring. That's the recyclable-module goal.

The **next sources** are pre-scoped in the survey (all endpoints verified live): US Drought Monitor
(GeoJSON polygons — needs a polygon path in the exporter), CA groundwater (CNRA CKAN), NID dams,
SNOTEL snow, OpenET (needs a free API key).

---

## 6. The site

- **Svelte 5** (runes: `$state`/`$derived`/`$props`) + **Vite**, plain SPA — builds to static `dist/`.
- **MapLibre GL** (open-source) with a **keyless** CARTO-light raster basemap (OSM data). No token.
- **Data-driven UI:** `App.svelte` fetches `layers.json` and builds toggles + map layers from it.
  Adding a source ⇒ it appears in the sidebar automatically after re-export.
- **`lib/map.js`** is the recyclable bit: `createMap`, `addLayerFromManifest` (handles clustering for
  dense layers, a % full color ramp for reservoirs, click popups), `setLayerVisibility`.
- **`Splash.svelte`** — the open-data intro (Long Now / "citizen atlas" framing) the project asked for.

---

## 7. Run it

```bash
# 1. collect (any subset, or --all). Re-runnable; resumes.
npm run aggregate -- --all          # ~30s: 6.7k gauges, 22 reservoirs, 64k PODs
npm run aggregate -- cdec-reservoirs # just one

# 2. export to GeoJSON the site reads
npm run export

# 3. run the map (installs site deps on first run)
cd site && npm install && npm run dev      # http://localhost:5180
# or from root: npm run site
```

---

## 8. Known limits / next (v1 honesty)

- **Water rights = locations only.** The eWRIMS POD layer has *where*, not *how much* (face value),
  *who*, or *status*. The amount/owner/status live in the CKAN tabular mirror; join by `APPL_ID` to
  unlock the real "paper vs wet water" overlay. **This is the highest-value next step.**
- **`waterrights.geojson` is ~13 MB** (58k points). Fine on localhost with clustering; for production
  switch dense layers to **vector tiles / PMTiles** or server-side bbox queries.
- **No live values on the map for gauges without recent daily data** (~2.9k of 6.7k have flow today).
- **USGS OGC API** may require a free API key above light use — keyless was fine for our page counts.
- **Reservoir capacities** are curated public figures in the seed; verify against USACE NID for rigor.
- **MapLibre bundle is ~1 MB** (304 KB gzip) — expected; code-split later if it matters.
