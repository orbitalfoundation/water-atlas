# Water Atlas — Initial Data Survey & Fresh-Take Plan

**Date:** 2026-06-19
**Author:** Anselm (+ Claude)
**Status:** Living document — first pass

---

## 0. Context: reviving the New California Water Atlas

This project is a fresh take on the **New California Water Atlas** (≈2012–2014), led by Laci
Videmsky at the Resource Renewal Institute, with Huey Johnson and Stewart Brand as advisors.
Writeup: <https://longnow.org/ideas/the-new-california-water-atlas/>

The original atlas revived a **1979 printed state atlas** as interactive maps. Its three headline
layers were:

1. **Water rights** — who is allowed to divert how much, from where (State Water Board data).
2. **Groundwater levels** — 30 years of records from ~15,000 monitoring wells.
3. **Water pricing** — with the CPUC; the insight that *"water isn't priced according to scarcity,
   it's priced according to the price of delivering the water."*

Its philosophy was a **"citizen atlas, where citizens' science sits alongside authoritative data"** —
open government applied to environmental data.

### Why a fresh take now (what changed in ~12 years)

The original atlas is **offline** today — link rot. That is, ironically, the single best argument
for a Long-Now-flavored rebuild: **durable, open, trivially re-buildable from public sources.**
Everything here should be reproducible from a `git clone` + a shell command.

Concretely, the data landscape is dramatically better than in 2013:

| Then (~2013) | Now (2026) |
|---|---|
| Water rights = slow scrape of a web app | Possible **bulk download / ArcGIS / data.ca.gov mirror** (verifying) |
| No field-level consumption data | **OpenET** (2021): satellite evapotranspiration *per field*, monthly |
| Groundwater = patchy | **SGMA** (2014) created sustainability agencies + far more GW data |
| USGS legacy SOAP/REST | **USGS modernized OGC APIs** (clean GeoJSON; legacy decom Q1 2027) |
| Mapbox GL (later went proprietary 2020) | **MapLibre GL** — fully open-source fork |
| Heavy CMS stacks | **SQLite + static site**, deployable anywhere, ~free |

### The narrative spine

Water rights are a list. Water rights **next to actual flow** are a story. California has granted
paper water rights totaling roughly **5× the water that actually flows** in an average year. The
atlas's job is to make the gap between **paper water and wet water** visible:

> where it comes from (snow, rain) → where it's stored (reservoirs) → who's allowed to take it
> (rights) → who actually takes it (diversions, ET) → what's left for the river & the aquifer.

---

## 1. Prioritization

**Tier 1 — v1 targets (verified live this session, trivial JSON/GeoJSON, mappable):**

| # | Source | What | Access | Ease | Status |
|---|---|---|---|---|---|
| 1 | **USGS monitoring locations** | Stream gauges & sites (CA) w/ lat-lon | OGC API → GeoJSON | 5 | ✅ verified |
| 2 | **USGS daily/latest values** | Live streamflow (discharge 00060) | OGC API → JSON | 4 | ✅ verified |
| 3 | **CDEC reservoirs** | Real-time CA reservoir storage | JSON servlet | 4 | ✅ verified |
| 4 | **CDEC snow (SWE)** | Snow-water-equivalent sensors | JSON servlet | 4 | same API as #3 |

**Tier 2 — fast follows (high value, modest effort):**

| # | Source | Why it matters | Notes |
|---|---|---|---|
| 5 | **eWRIMS water rights** | THE headline layer — paper-vs-wet-water | ✅ **DONE in v1** — ArcGIS FeatureServer, the month-long scrape is dead (see §3) |
| 6 | **OpenET** | The modern wow factor — field-level ET | Needs free registration; great overlay vs rights |
| 7 | **US Drought Monitor** | Weekly drought polygons; instant context | GeoJSON; easy raster/poly layer |
| 8 | **NRCS SNOTEL / AWDB** | Mountain snow telemetry (broader than CA) | REST API |

**Tier 3 — later layers (richer, heavier, or niche):**

| # | Source | Why |
|---|---|---|
| 9 | **CA groundwater (SGMA / periodic levels)** | The Videmsky layer, modernized; subsidence is dramatic |
| 10 | **National Inventory of Dams (NID)** | Every dam, mappable, with hazard class |
| 11 | **EPA SDWIS / ECHO** | Drinking-water systems + violations (PFAS, nitrate, arsenic) |
| 12 | **NOAA National Water Model / AHPS** | Flood/forecast; huge but operationally complex |
| 13 | **CIMIS** | CA reference ET stations (irrigation) — needs key |
| 14 | **Water pricing** | Original atlas layer; hard — no clean statewide feed |
| 15 | **Fish / environmental flows** | Salmon counts, dam passage; ecological angle |

> Design principle: **v1 ships Tier 1 end-to-end** (collect → store → map). Everything else is a
> new `source` module dropped into the same machine. We earn breadth by keeping each source small.

---

## 2. Tier-1 source details (verified against live APIs, 2026-06-19)

### 1–2. USGS Water Data — modernized OGC API

- **Base:** `https://api.waterdata.usgs.gov/ogcapi/v0/`
- **⚠️ Migration:** legacy `waterservices.usgs.gov` (NWIS) is **decommissioned Q1 2027**
  (intentional degradation may start Aug 2026). **Build on the OGC API, not NWIS.**
- **Collections:** `monitoring-locations`, `daily`, `continuous`, `latest-daily`,
  `latest-continuous`, `field-measurements`, `parameter-codes`, `states`, `site-types`, … (35 total)
- **Sites (mappable):** GeoJSON `FeatureCollection`, Point geometry, rich properties.
  - Filter by `state_code=06` (California FIPS) and `site_type_code=ST` (Stream).
  - Example:
    `…/collections/monitoring-locations/items?state_code=06&site_type_code=ST&limit=1000&f=json`
- **Pagination:** **no `numberMatched`**; follow the `links[].rel == "next"` href (a `cursor=`
  token). Loop until there is no `next`.
- **Live values:** `latest-daily` / `daily` collections; discharge is **parameter code `00060`**
  (cfs), gage height `00065`. Join to sites by `monitoring_location_number`.
- **Auth:** none. **Format:** GeoJSON/JSON. **License:** US public domain.
- Sanity check today: `SACRAMENTO R NR HAMILTON CITY` → `[-121.9955, 39.7515]`.

### 3–4. California CDEC — reservoirs & snow

- **Data servlet (JSON):**
  `https://cdec.water.ca.gov/dynamicapp/req/JSONDataServlet?Stations=SHA&SensorNums=15&dur_code=D&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
  - Returns a clean JSON array: `{stationId, SENSOR_NUM, sensorType, date, value, units, dataFlag}`.
  - **Sensor numbers:** `15` = reservoir storage (AF), `6` = reservoir elevation,
    `76` = reservoir inflow, `3`/`82` = snow water content (SWE, inches), `2` = precip accumulated.
  - **dur_code:** `E` event, `H` hourly, `D` daily, `M` monthly.
- **Station coords:** `…/dynamicapp/staMeta?station_id=SHA` (HTML; lat/lon parseable). Reservoir set
  is stable → we ship a **curated seed** of major reservoirs (code, name, lat, lon, capacity) and
  pull live storage per code. Seed built once; runtime stays robust if CDEC's HTML shifts.
- **Auth:** none. **Format:** JSON/CSV. **License:** CA state data, public.
- Sanity check today: Shasta (SHA) storage ≈ **3.83M AF** (capacity 4.55M → ~84% full).
- **% full** (`storage / capacity`) is the single most legible reservoir metric for the map.

---

## 3. Tier-2/3 notes (endpoints VERIFIED live, 2026-06-19)

> **The headline finding:** the eWRIMS month-long scrape is **dead**. Points of diversion are now an
> ArcGIS FeatureServer — a paginated query, done in ~20s. This single fact reframes the project: the
> "paper water" layer is cheap now, so the atlas can lead with it (and we did — it's in v1).

- **eWRIMS water rights (DONE)** —
  `https://gispublic.waterboards.ca.gov/arcgis/rest/services/Water_Rights/Points_of_Diversion/FeatureServer/0/query`
  - `where=1=1&outFields=*&outSR=4326&f=json`, paginate with `resultOffset` (maxRecordCount 2000).
  - Quirk: this server rejects `f=geojson` — use `f=json&outSR=4326` (Esri JSON, lon/lat).
  - 63,990 PODs. Caveat: POD layer is *locations only* — face value / owner / status come from the
    **CKAN tabular mirror** (`data.ca.gov` / `data.cnra.ca.gov`, join by `APPL_ID`). That join is the
    top next step to unlock true paper-vs-wet-water.
- **US Drought Monitor** — one GeoJSON call, weekly polygons, color by `DM` (0–4):
  `https://services5.arcgis.com/0OTVzJS4K09zlixn/arcgis/rest/services/USDM_current/FeatureServer/0/query?where=1=1&outFields=*&f=geojson`
  (needs a polygon path in the exporter — first non-point layer).
- **CA groundwater (the Videmsky layer, modernized)** — CNRA CKAN: 6.3M measurements across 47,604
  stations w/ lat-lon. Stations: `datastore_search?resource_id=af157380-fb42-4abf-b72a-6f9f98868077`;
  measurements `…?resource_id=bfa9f262-24a1-45bd-8dc8-138bc8107266`; join by `site_code`.
- **NID dams** — GeoJSON FeatureServer, ~92k US dams w/ hazard class:
  `https://geospatial.sec.usace.army.mil/dls/rest/services/NID/National_Inventory_of_Dams_Public_Service/FeatureServer/0/query?where=1=1&outFields=*&f=geojson`.
- **NRCS SNOTEL (AWDB)** — `https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data?stationTriplets=*:CA:SNTL&elements=WTEQ&duration=DAILY&beginDate=…&endDate=…`
  (`WTEQ`=snow-water-equivalent); coords from `/services/v1/stations`. "How much water is in the Sierra
  snowpack right now" = sum WTEQ.
- **NOAA NWPS (flood/forecast)** — `https://api.water.noaa.gov/nwps/v1/gauges?bbox.…` + a flood-status
  GeoJSON MapServer. (AHPS/`water.weather.gov` retired 2024 → NWPS at `water.noaa.gov`.)
- **EPA SDWIS (drinking water)** — `https://data.epa.gov/efservice/WATER_SYSTEM/STATE_CODE/CA/ROWS/0:100/JSON`
  (append `/JSON`). ~20k CA systems + violation history. ⚠️ not point-located out of the box — join
  the FRS RegistryID to ECHO Exporter coords to map it.
- **OpenET** — `https://openet-api.org/raster/timeseries/point` (POST, `Authorization` header).
  Free key + per-user compute quotas. The only v1-adjacent source needing registration.

Full ranked table with auth/format/ease in the background-research dump (folded into this doc's
priorities). All ten above were fetched live and returned real data on 2026-06-19.

---

## 4. v1 scope (what we actually build first)

1. Aggregator pulls **USGS CA stream sites** + **CDEC major-reservoir storage** into SQLite.
2. Exporter dumps per-layer **GeoJSON** to the site.
3. Svelte 5 + **MapLibre** site: a **splash/intro** on open water data (echoing the Videmsky
   "citizen atlas" ethos), then a map with **toggleable layers** and **click popups**
   (gauge → latest flow; reservoir → storage & % full).

Success = a stranger can `git clone`, run one shell command, and see live California water on a map.

---

## 5. Aggregator policy (summary — full design in a separate note)

- **Idempotent upserts** keyed on natural IDs (`source + external_id`); never duplicate.
- **Incremental / resumable:** persist a per-source **watermark** (cursor / last date) so re-runs
  *continue*, not restart. USGS → save the `next` cursor; CDEC → save last observation date.
- **Polite by default:** rate-limit, exponential backoff + retry, descriptive User-Agent.
- **Raw cache + provenance:** every record stores `source`, `fetched_at`; raw payloads cached on
  disk so re-normalizing doesn't re-fetch.
- **Small modules:** one file per source implementing a shared interface; core handles HTTP, cache,
  DB, state. Sources are recyclable across projects.

---

## 6. Open questions / next

- [ ] Does eWRIMS have a bulk/ArcGIS source now? (kills or keeps the month-long scrape)
- [ ] OpenET registration + rate limits; can we cache tiles/zonal stats?
- [ ] Reservoir **capacities** — authoritative table (CDEC vs USACE NID) for accurate "% full".
- [ ] Map base style: self-hosted OSM raster (zero-key) vs a vector style.
- [ ] Hosting/durability story (static + periodic GitHub Action to refresh GeoJSON?).
