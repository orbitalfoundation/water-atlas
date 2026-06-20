// California water rights — Points of Diversion (POD) from the State Water Board's eWRIMS.
// THE headline "paper water" layer: every place a water right lets someone divert.
// Source is an ArcGIS FeatureServer (the old project scraped this for ~a month; now it's a query).
// Quirk: this server only speaks Esri JSON (no f=geojson); we request outSR=4326 for WGS84 lon/lat.
const ID = 'ca-water-rights';
const LAYER = 'waterrights';
const ENDPOINT =
  'https://gispublic.waterboards.ca.gov/arcgis/rest/services/Water_Rights/Points_of_Diversion/FeatureServer/0/query';
const PAGE = 2000; // server maxRecordCount
const FIELDS = 'POD_ID,APPL_ID,APPL_POD,POD_NUM,SOURCE_NAME,TRIB_DESC,WATERSHED,COUNTY,HU_8_NAME,LOCATION_METHOD,LATITUDE,LONGITUDE';

export default {
  id: ID,
  title: 'California water rights — points of diversion (eWRIMS)',
  layer: LAYER,
  description: 'Permitted/licensed points of diversion across CA — the "paper water" layer.',
  style: { color: '#d9602a', cluster: true, kind: 'right' },
  exportProps: ['appl_id', 'source_water', 'watershed', 'county'], // keep the 58k-point file lean

  // Full snapshot each run; idempotent upserts make re-runs safe (and a crash just re-pulls).
  async run({ store, http, log }) {
    let offset = 0;
    let total = 0;
    for (;;) {
      const url = `${ENDPOINT}?where=1%3D1&outFields=${FIELDS}&outSR=4326&orderByFields=OBJECTID` +
        `&resultOffset=${offset}&resultRecordCount=${PAGE}&f=json`;
      const j = await http.getJson(url);
      const feats = j.features || [];
      if (!feats.length) break;
      for (const f of feats) {
        const a = f.attributes || {};
        const lat = num(a.LATITUDE ?? f.geometry?.y);
        const lon = num(a.LONGITUDE ?? f.geometry?.x);
        if (lat === null || lon === null || (lat === 0 && lon === 0)) continue; // skip ungeocoded
        store.feature({
          source: ID, layer: LAYER, external_id: a.APPL_POD || `${a.APPL_ID}_${a.POD_NUM}`,
          name: a.APPL_ID, lat, lon,
          props: {
            appl_id: a.APPL_ID, pod: a.POD_NUM, source_water: a.SOURCE_NAME,
            tributary: a.TRIB_DESC, watershed: a.WATERSHED, county: a.COUNTY,
            basin: a.HU_8_NAME, loc_method: a.LOCATION_METHOD,
          },
        });
        total++;
      }
      log.dim(`  PODs: ${total}`);
      if (feats.length < PAGE && !j.exceededTransferLimit) break;
      offset += PAGE;
    }
    log.info(`points of diversion upserted: ${total}`);
    return { stats: { pods: total } };
  },
};

const num = (v) => (v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));
