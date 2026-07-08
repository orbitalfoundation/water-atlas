# Rivers layer shipped + West Coast expansion scouting (WA · BC)

**Date:** 2026-07-08
**Status:** The atlas now draws actual hydrography — NHDPlus flowlines, width by
stream order, mountains-to-sea. This note records what shipped and the verified
endpoints for the next expansion: **Washington** (cheap — completes the US West
Coast) and **British Columbia** (surprisingly feasible). Companions:
[20260620-neighboring-states-data-scouting.md](20260620-neighboring-states-data-scouting.md)
(the OR/NV scouting this continues), [20260620-current-todos.md](20260620-current-todos.md).

---

## ✅ Shipped 2026-07-07

- **Rivers & streams layer** — `sources/nhdplus-rivers.js` pulls EPA WATERS'
  medium-res (1:100k) **NHDPlus V2 Network Flowline** layer: 50,270 flowlines at
  **Strahler order ≥ 4** in the CA+OR(+NV) bbox, with `gnis_name`, `streamorder`,
  `qe_ma` (mean annual flow, cfs), `totdasqkm`. 26 MB raw / ~5.5 MB gzipped.
  Endpoint: `watersgeo.epa.gov/arcgis/rest/services/NHDPlus/NHDPlus/MapServer/2`
  (paginated 2000/page, `f=geojson`, disk-cached — the dataset is static).
  - New site `kind: 'line'` — width scales with stream order and zoom; popup
    shows name / flow / order / drainage. `ftype` arrives as *numeric* NHD codes
    (460 StreamRiver, 336 CanalDitch, 558 ArtificialPath…), mapped in `map.js`.
  - Found & fixed a draw-order bug: `KIND_ORDER` drew the drought wash **on
    top** of everything (its comment claimed the opposite). Now `MAP_ORDER`
    (fill bottom → lines → points) is decoupled from `KIND_ORDER` (sidebar
    display order).
  - Rejected alternates: NHDPlus **HR** (1:24k — 112k+ segments even at
    1000 km² drainage, slow server), Esri's 1:1M USA Rivers (6k features but no
    order/flow attribute to drive line width).
- **On-VM CI/CD** — `deploy/autodeploy.sh` + `deploy/setup-autodeploy.sh`:
  systemd timer on the VM polls `git ls-remote` on public `main` every ~2 min;
  on change → pull, `npm run export`, vite build, rsync to `/srv/site`.
  **Pushing to main is now the deploy.** No tokens/webhooks (public repo,
  outbound poll only). The VM keeps its own `data/water.db` (seeded from a
  laptop; gitignored). See deploy/README.md § Continuous deployment.

## 🗺️ Washington — verified endpoints (completes the US West Coast)

All probed 2026-07-07 and answering:

| Layer | Path | Size | Effort |
| --- | --- | --- | --- |
| Rivers | same EPA NHDPlus service, widen bbox north to 49.05 | **+9,095** flowlines (order ≥ 4) | trivial — BBOX constant in `nhdplus-rivers.js` |
| Gauges | same USGS OGC API, `state_code=53` | similar to CA's 6.7k | small — de-hardcode CA (`CA_FIPS`/`CA_BBOX`) into a per-state list (OR=41, NV=32, WA=53) |
| Drought | USDM is national — widen the CA clip bbox in `us-drought.js` | 0 new fetches | trivial |
| Water rights | Ecology hosted AGOL: `services.arcgis.com/6lCKYNJLvwTXqrmp/…/WR/FeatureServer` — layer **5** verified device points (**165,281**), layer 4 unverified (76,328), maxRecordCount 2000 | ~like NV | small-medium |
| Reservoirs | no CDEC analog: USBR Hydromet/RISE (Yakima/Columbia) or USACE CWMS Data API; needs a capacity seed like `cdec-reservoirs.seed.json` | ~dozens of reservoirs | medium |

**WA rights caveat:** the GIS layer is attribute-thin — `D_Point_ID`, type, and
a `WaterRights_Relate` table (layer 7) linking to `WR_Doc_NR` only. **No
owner / use / priority / quantity** in the service; those live in Ecology's
WRTS/GWIS and would need a download + join. Ship sparse first (the shared popup
already adapts to missing fields), enrich later.

**When crossing state lines, also touch:** sidebar tagline ("California · live
water data"), splash copy, map initial center/zoom (CA-framed today), and the
FAQ.

## 🍁 British Columbia — feasible except reservoirs

BC's open-data stack (DataBC WFS + federal OGC APIs) is genuinely good. Probed
2026-07-07:

- **Water licences** — DataBC WFS `WHSE_WATER_MANAGEMENT.WLS_WATER_RIGHTS_LICENCES_SV`
  (`openmaps.gov.bc.ca/geo/pub/…/ows`): **116,825** points, clean GeoJSON
  (`outputFormat=application/json&srsName=EPSG:4326`, page via
  `count`/`startIndex`). *Richer than WA*: licence #, status, **priority date**
  (BC is FITFIR — first-in-time, first-in-right), purpose, quantity — but in
  **m³/year** (convert: 1 AF ≈ 1233.48 m³).
- **Gauges** — ECCC OGC API `api.weather.gc.ca/collections/hydrometric-stations`
  (**2,324** BC stations incl. discontinued; filter `STATUS_EN=Active`) +
  realtime/daily discharge collections (m³/s → cfs ×35.315).
- **Hydrography** — Freshwater Atlas `WHSE_BASEMAPPING.FWA_STREAM_NETWORKS_SP`
  (WFS, has `STREAM_ORDER` + names, `CQL_FILTER` works) but 1:20k dense:
  order ≥ 5 → 288,657 · **≥ 6 → 134,779 · ≥ 7 → 61,487**. Needs a
  threshold/clip decision (e.g. southern BC < 52°N at ≥ 6) to keep size sane.
- **Drought** — "BC Drought Levels" basin polygons (levels 0–5) as an AGOL
  feature layer (DataBC item `f1842161d9c2454a98f9fc3b45d5d92e` on bcgov03);
  different scale than USDM D0–D4 but same wash treatment. Canadian Drought
  Monitor (AAFC, monthly, national) is the alternative.
- **Reservoirs** — **hard**: BC Hydro publishes no usable public API.

## Suggested order of attack

1. WA rivers + gauges + drought (an afternoon; "whole US West Coast" moment)
2. WA rights, sparse attributes (same PR or next)
3. BC licences + gauges (high value, low effort; first metric-unit handling)
4. BC hydrography after a sizing decision · WA reservoirs (USBR/USACE) whenever
5. BC drought wash · reservoirs stay US-only for now
