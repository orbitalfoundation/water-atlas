# P2 done — US Drought Monitor (first polygon layer)

**Date:** 2026-06-20
**Status:** Built end-to-end, verified locally (aggregate → export → build all clean).
**Not yet committed or deployed** (holding per user). Companion to
[20260620-current-todos.md](20260620-current-todos.md) (P2 spec).

## What shipped

The atlas's **first non-point (polygon) layer** — the design path the todos flagged as the real
reason to do P2 before P3 (groundwater basins / watersheds reuse it).

- **Data model** (`core/db.js`): added a nullable `geometry TEXT` column to `features` (GeoJSON
  geometry blob). Points still use `lat`/`lon`; polygons/lines set `geometry`. Forward-only
  `migrate()` runs `ALTER TABLE … ADD COLUMN` in try/catch so existing DBs upgrade silently.
  Added `store.clearFeatures(source)` for **snapshot layers** that fully replace each run.
- **Exporter** (`export-geojson.js`): selects rows with `geometry OR lat/lon`; emits the stored
  geometry when present, else a Point. `roundCoords()` rounds every nested coordinate to ~1 m so
  polygon files stay small (drought = ~104 KB).
- **Source** (`sources/us-drought.js`): pulls the live national USDM ArcGIS FeatureServer
  (`f=geojson`), explodes Multipolygons into parts, and keeps only parts whose bbox intersects a
  **California bbox** — a cheap clip (neighboring-state parts dropped; some border bleed remains).
  `clearFeatures()` first → no stale weeks. One feature per (DM category, part). Result: ~9 CA
  polygons, valid date from `ValidStart` (epoch ms). `cache: 'bypass'` (weekly snapshot).
- **Map** (`lib/map.js`): `KIND_ORDER` now `['drought','right','gauge','reservoir']` → drought
  renders at the bottom. New `kind === 'fill'` branch adds a `fill` (color by `dm` via official
  USDM palette D0→D4, opacity 0.35) + thin `line` outline. `bindPopup` anchors at click for
  polygons (no single coord). `setLayerVisibility` toggles `fill`/`outline` too.

## Gotchas captured (for the next polygon source)

- USDM field is **`DM`** (uppercase) and date is **`ValidStart`** (epoch ms) — *not* `dm`/`Date`.
  Used `outFields=*` so an unknown-field name can't 400 the query.
- The clip is bbox-only. Polygons straddling the CA border still show a little into NV/OR. Fine for
  v1; true clip would need a CA boundary polygon (defer).
- Snapshot vs time-series: drought is snapshot (clearFeatures). Groundwater (P3) is time-series —
  do **not** clearFeatures there; fold latest obs like reservoirs.

## Copy / framing (user ask: "moving beyond the original scope, honoring the deeper vision")

- New FAQ entry "Is this just the old atlas again — or something more?" frames live conditions
  (drought now; groundwater/snowpack/flow next) as honoring the 1979/2013 atlas's *living-picture*
  vision rather than copying its map list.
- FAQ "how to use", data-provenance answer (adds USDM = NOAA/USDA/NDMC), and the Sidebar legend all
  mention the drought wash (yellow→dark red).

## Refresh

USDM updates **Thursdays**. Tie `us-drought` into the periodic refresh job (todos P0 open Q) so the
wash stays current. To refresh now: `node aggregator/cli.js us-drought && npm run export`.
