# Scouting — extending beyond California (neighboring-state water data)

**Date:** 2026-06-20
**Status:** Research only (nothing built). Endpoints verified live 2026-06-20.
Prompted by "do nearby states have similar data?" Companion to
[20260620-current-todos.md](20260620-current-todos.md).

## Headline

- **Gauges + reservoirs go multi-state nearly for free.** USGS NWIS (our gauge source) is national —
  just widen/drop the CA filter. USBR **RISE** (`data.usbr.gov/rise/api`, JSON:API) is one source
  covering ~1,000 Western reservoirs (NV/AZ/ID/UT/OR/WA). No CDEC equivalent exists elsewhere.
- **Water rights are per-state** (no live national compilation — WaDE/WestDAAT froze ~Mar 2026), BUT
  most neighbors expose PODs on an **ArcGIS FeatureServer with offset paging** — the *same pattern*
  as `aggregator/sources/ca-water-rights.js`. New state ≈ copy module, swap endpoint + field names.
  All prior-appropriation, so conceptually identical to CA.
- **Bonus new layer type:** NRCS **SNOTEL** snowpack — national API
  (`wcc.sc.egov.usda.gov/awdbRestApi/services/v1/stations?networkCds=SNTL&stateCds=XX`). This is the
  "where water comes from" head of the snow→reservoir→rights→flow story the FAQ tells. Possibly a
  better *next* layer than another point dataset.

## Water-rights POD endpoints (ranked by ease)

| State | Access | Endpoint | Notes |
|---|---|---|---|
| **Idaho** | ArcGIS REST + Extract (easiest) | `gis.idwr.idaho.gov/hosting/rest/services/Allocation/WaterRightPods/FeatureServer/0` | **273k PODs**, csv/shp/geojson export. Best first neighbor. |
| **Nevada** | ArcGIS REST | `arcgis.water.nv.gov/arcgis/rest/services/NDWR/Water_Rights_Points_of_Diversion/FeatureServer/0` | + `Water_Rights_Places_of_Use`. |
| **Oregon** | ArcGIS REST (`f=geojson`) | `gis.wrd.state.or.us/server/rest/services/dynamic/PODs_By_Source_WGS84/FeatureServer` | 5 point layers. |
| **New Mexico** | ArcGIS REST | `services2.arcgis.com/qXZbWTdPDbTjl7Dy/arcgis/rest/services/OSE_Points_of_Diversion/FeatureServer/0` | **278k PODs**. Trivial. |
| **Colorado** | REST API, `format=geo` | `dwr.state.co.us/Rest/GET/api/v2/structures` (+ `waterrights/netamount`) | Free key. Gold standard. |
| **Arizona** | ArcGIS (AGOL org) | `services.arcgis.com/C34zQ7veRS0V1t04/arcgis/rest/services/Approved_Abstract_POD/FeatureServer/1` | Note surface vs groundwater (AMA) split. `gisweb.azwater.gov` blocks bots — use AGOL. |
| **Utah** | ArcGIS (subset only) | `services.arcgis.com/ZzrwjTRez6FJiOq4/arcgis/rest/services/DWR_PODs_VIEW/FeatureServer/0` | Public layer ~1,500 pts only; full set via Open SGID PostGIS. |
| **Washington** | bulk GDB only | `fortress.wa.gov/ecy/gispublic/DataDownload/wr/GWIS_Data/GWIS_SDEexport.zip` | ~172 MB file GDB, no live REST. Low priority. |
| **Wyoming** | hard scrape | GeoHub stale 2007 layer; current data in e-Permit, no API. | Worst. Skip. |

## Reservoir storage — federal backbone (no state CDEC analogs)

- **USBR RISE** (national): `data.usbr.gov/rise/api` — `/location`, `/catalog-item`, `/result`.
  Quirk: numeric `stateId` filtering unreliable; query by string `stateId=UT` or by name.
- Lower Colorado (Mead/Powell/Mohave/Havasu — covers NV/AZ): hourly JSON
  `usbr.gov/lc/region/g4000/hourly/levels.html`; Upper Colorado CSV under `usbr.gov/uc/water/hydrodata`.
- Pacific NW (ID): Hydromet CGI `usbr.gov/pn-bin/daily.pl?station=AND&pcode=af` (daily acre-feet).
- OR/WA Columbia/Snake/Willamette: USACE **CWMS Data API** `cwms-data.usace.army.mil/cwms-data/`
  (needs header `Accept: application/json;version=2`).

## Other national one-shot datasets

- **USGS NWIS** gauges — `waterservices.usgs.gov/nwis/iv/?stateCd=XX&parameterCd=00060` (legacy, sunset
  ~2027) → migrate to OGC API `api.waterdata.usgs.gov/ogcapi/v0/`. We already use this for CA.
- **National Inventory of Dams** — `nid.sec.usace.army.mil/api/nation/csv` (one 67 MB CSV).
- **US Drought Monitor** — already rendered (`us-drought.js`).

## Recommended order (highest leverage first)

1. Widen NWIS off the CA filter + add **one USBR RISE** source → gauges + reservoirs across the
   whole West with ~no per-state code.
2. Add **Idaho** water rights as the proof-of-concept neighbor (near-clone of `ca-water-rights.js`),
   then **Nevada**, **Oregon**.
3. Consider **SNOTEL snowpack** as the next *story* layer (new data type, completes the headwaters end).

Design note: multi-state means the map's CA-centric framing (splash copy, default center/zoom in
`lib/map.js`, "California" titles) needs a rethink — decide whether this becomes a "Western US"
atlas or stays CA-first with neighbors as context.
