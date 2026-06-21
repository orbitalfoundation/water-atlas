# Water Atlas — Current TODOs (priority order)

**Date:** 2026-06-20 (revised later same day after shipping v1.1)
**Status:** Live and public at **https://water-atlas.exe.xyz** — gauges + reservoirs + water-rights
points + drought wash, with About/FAQ. Priorities below are re-ordered around the new theme that
emerged: **go multi-state** (esp. Oregon & Nevada). Companions:
[20260619-architecture.md](20260619-architecture.md) (how it's built),
[20260619-initial-survey.md](20260619-initial-survey.md) (CA data),
[20260620-neighboring-states-data-scouting.md](20260620-neighboring-states-data-scouting.md)
(verified out-of-state endpoints),
[20260620-p2-drought-polygon-layer.md](20260620-p2-drought-polygon-layer.md) (polygon path).

---

## ✅ Shipped

- **Deploy + public** — live on the exe.dev VM (Caddy in Docker, `https://water-atlas.exe.xyz`),
  verified serving. `deploy/{provision,deploy}.sh` idempotent.
- **About / FAQ** — `Faq.svelte` sectioned accordion (origins, why, how, stakeholders, further
  reading, acknowledgements, links). Build date stamped in the footer.
- **Drought layer (P2)** — US Drought Monitor polygons (D0–D4), the first **polygon** path through
  db → exporter → map. Data model now has a `geometry` column + snapshot `clearFeatures()`.
- **Site polish** — paper-vs-wet visual on the splash (sourced to Grantham & Viers), Orbital
  Foundation links, further-reading list, original-team credits.
- **Oregon + Nevada water rights** — `sources/or-water-rights.js` (186,538 PODs across OWRD's 5
  source-type sublayers; carries owner / use / priority / amount) + `sources/nv-water-rights.js`
  (109,976 PODs; status / rate / priority). Each its own layer (`waterrights-or`, `waterrights-nv`),
  distinct color, adaptive popup (shared, shows only fields a state provides) with per-agency footer.
  **Both `hidden: true` → lazy-loaded** (51 MB / 25 MB) so initial load stays light; `clearFeatures`
  on each run. Required: a `hidden` manifest flag + lazy-attach-on-toggle in `App.svelte`.

---

## P1 — PMTiles / vector tiles for the dense layers  ·  *now the urgent follow-up* ⭐

**Why:** OR (186k) + NV (110k) + CA (58k) = ~355k rights points. We shipped them **lazy-loaded and
off by default** as a stopgap, but the raw GeoJSON is 51 MB (OR) / 25 MB (NV) — toggling one on is a
heavy download and a big client-side parse, rough on phones. PMTiles is the proper fix and is now the
highest-value next step (was P3).

**How:** bake `.pmtiles` with **tippecanoe** (build-time tool, fits the ethos — no runtime server),
add the `pmtiles://` protocol to MapLibre, host the static `.pmtiles`. Lets us drop the lazy-load
stopgap and turn the neighbor layers back on by default. Doubles as the **GeoParquet/PMTiles export**
that makes our data open in GeoLibre/QGIS (see architecture note). Already in place: Caddy gzip/zstd,
6-dp rounding, clustering, lazy-load.

**Open Q:** is `tippecanoe` an acceptable dev-time dependency given the rebuild-from-clone ethos? (It
is build-time only, so yes — but document the install step.)

---

## P2 — Multi-state gauges + reservoirs  ·  *huge coverage, almost no code*

**Why:** these two layers are essentially national datasets we currently just clip to CA. Widening
them lights up the whole West for near-zero effort — the cheapest possible "this is regional now."

**How:**
- **Gauges** — USGS NWIS is national; drop/widen the CA `stateCd` filter in the existing
  `usgs-sites.js` to include OR/NV (or all Western states). (Note: legacy `waterservices.usgs.gov`
  sunsets ~2027 → plan migration to OGC API `api.waterdata.usgs.gov/ogcapi/v0/`.)
- **Reservoirs** — no CDEC analog out of state; add **one** USBR RISE source
  (`data.usbr.gov/rise/api`, JSON:API) covering ~1,000 Western reservoirs. `stateId` numeric filter
  is flaky — query by string `stateId=OR` or by name. New `sources/usbr-rise.js`.

**Open Q:** keep CDEC for CA reservoirs (richer % full) and RISE for the rest, or unify on RISE?
Probably keep both, tag by source.

---

## P3 — eWRIMS CKAN join: face value, owner, status  ·  *the original thesis, still unbuilt*

**Why:** turns CA `waterrights` from locations-only into amount/owner/status — makes the paper-vs-wet
gap real per point, not just a headline. Still high value; de-prioritized only because the multi-state
story is the more energizing win right now and shares no code with it.

**How:** `data.ca.gov` / `data.cnra.ca.gov` CKAN `datastore_search` for the rights/use tables, join to
existing PODs by **`APPL_ID`**. Enrich props (`face_value_af`, `owner`, `status`, `priority_date`,
`use_type`); update popup template. **Open Qs:** exact `resource_id`(s) for the amounts table; join
coverage (surface unmatched count honestly); face-value units/semantics (AF/yr? diversion vs storage).

---

## P4 — SNOTEL snowpack  ·  *the missing head of the story*

**Why:** "where the water comes from." NRCS SNOTEL is a clean national API
(`wcc.sc.egov.usda.gov/awdbRestApi/services/v1/stations?networkCds=SNTL&stateCds=XX`) — a genuinely
new *data type* that completes snow → reservoir → rights → flow. Possibly a better story layer than
yet another point dataset.

---

## P5 — CA groundwater (SGMA / periodic levels)  ·  *the Videmsky layer, modernized*

(Unchanged from before — see prior detail.) CNRA CKAN stations
`resource_id=af157380-fb42-4abf-b72a-6f9f98868077` + measurements
`resource_id=bfa9f262-24a1-45bd-8dc8-138bc8107266`, join by `site_code`. 6.3M measurements — pull
latest-per-station only. Time-series, so **do not** use `clearFeatures` (unlike drought); fold latest
obs like reservoirs.

---

## Cross-cutting decision — CA-first vs Western atlas  ·  *DECIDED: Option A*

We went **Option A — "California + neighbors as context":** CA stays the star (map still centers on
CA, splash/FAQ copy CA-led, headline splash stat is CA's 58k), OR/NV are per-state layers, off by
default, welcomed in the FAQ/legend. User confirmed they like the CA centering. Option B ("Western US
Water Atlas" — recenter, rename, generalize) remains a clean later rename, not a rewrite, if the
neighbor set grows. Decision rationale: our data is deepest in CA and lazy-loaded neighbors keep the
default experience CA-focused.

---

## Architecture note — GeoLibre & open GIS tooling

User asked specifically about **GeoLibre** (https://geolibre.app/, `opengeos/GeoLibre`). Important: it
is **not** a GIS server — it's a client-side GIS *workbench* (Tauri + React + MapLibre + DuckDB-WASM
+ deck.gl), browser-native, no backend, reads PMTiles/GeoParquet/FlatGeobuf/COG. So it actually
*shares* our durability values. Position (now written into the FAQ, "What about an open GIS workbench
like GeoLibre?"):

- **Don't rebuild the public site *on* GeoLibre.** It's a general-purpose *workbench* (a tool for
  doing GIS); the Atlas is an opinionated *narrative* for citizens with a tiny static payload. Same
  reasoning as the existing "why not kepler.gl / Felt" answer — wrong surface for the audience, and a
  heavy bundle — but now stated honestly as workbench-vs-story, not open-vs-proprietary.
- **Do embrace it two ways:** (1) the open, zero-install analysis companion we point power users to
  (replaces "use QGIS"); (2) a *consumer* of our outputs — reason to emit **GeoParquet / PMTiles**
  that GeoLibre (and QGIS) open directly. Ties into P3.

Broader stack rule still holds: **open GIS *tools at build time* — yes; a GIS *server* at runtime —
no.** Build-time wins: **tippecanoe** (PMTiles, P3), **GDAL/ogr2ogr** (fetch/convert state ArcGIS
data), **DuckDB-spatial / PostGIS locally** for heavy joins/clips (e.g. a *true* CA-boundary clip for
drought vs. today's bbox approximation; watershed aggregation). All run during `aggregate`/`export`,
output stays 100% static. A runtime server (GeoServer/GeoNode/QGIS Server) reintroduces the exact
dependency that killed the original atlas — avoid. We already use the best open *frontend* (MapLibre);
if data outgrows static files, the minimal step is a read-only tile server (Martin / hosted
`.pmtiles`), still essentially static.

---

## Quick reference — priority at a glance

| P | Item | Value | Effort | Notes |
|---|------|-------|--------|-------|
| 1 | PMTiles / perf | ⭐ now urgent | Med | tippecanoe; drops the OR/NV lazy-load stopgap |
| 2 | Multi-state gauges + reservoirs | High coverage | Low | widen NWIS + 1 RISE source |
| 3 | eWRIMS CKAN join | Highest CA-feature | Med | the original thesis |
| 4 | SNOTEL snowpack | New story layer | Low–Med | national API |
| 5 | CA groundwater (SGMA) | High | Med–High | time-series, no clearFeatures |

## Open questions to settle (cross-cutting)
- [x] **CA-first vs Western atlas identity** — DECIDED Option A (CA-first, neighbors as context).
- [x] One merged `waterrights` layer vs per-state layers? — per-state layers (one source = one layer).
- [ ] Automated refresh job (cron/Action: aggregate → export → deploy) — incl. weekly USDM (Thursdays).
- [ ] Keep CDEC for CA reservoirs + RISE for the rest, or unify on RISE?
- [ ] Custom domain before any wider announce?
