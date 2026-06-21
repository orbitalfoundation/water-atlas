// Nevada water rights — Points of Diversion from the NV Division of Water Resources (State Engineer).
// Prior-appropriation, like CA and OR. The dataset carries application status, the granted diversion
// rate, place-of-use acreage, and priority date. One ArcGIS point layer; full snapshot each run.
const ID = 'nv-water-rights';
const LAYER = 'waterrights-nv';
const ENDPOINT =
  'https://arcgis.water.nv.gov/arcgis/rest/services/NDWR/Water_Rights_Points_of_Diversion/FeatureServer/0/query';
const PAGE = 2000; // server maxRecordCount
const FIELDS = 'app,app_status,site_name,source_desc,basin,county,diversion_rate,pou_acre_total,priority_date,latitude,longitude';

export default {
  id: ID,
  title: 'Nevada water rights — points of diversion (NDWR)',
  layer: LAYER,
  description: 'Permitted points of diversion across Nevada, with status, rate & priority.',
  // hidden: large out-of-state layer — off by default, lazy-loaded on first toggle (25 MB).
  style: { color: '#7b3294', cluster: true, kind: 'right', hidden: true },
  exportProps: ['app', 'status', 'use', 'source_water', 'county', 'basin', 'priority', 'rate_cfs'],

  async run({ store, http, log }) {
    store.clearFeatures(ID); // full refresh; uniqueness is per-run
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
        const lon = num(a.longitude ?? f.geometry?.x);
        const lat = num(a.latitude ?? f.geometry?.y);
        if (lat === null || lon === null || (lat === 0 && lon === 0)) continue;
        store.feature({
          source: ID, layer: LAYER, external_id: total, name: clean(a.app) || clean(a.site_name),
          lat, lon,
          props: {
            app: clean(a.app), status: clean(a.app_status), source_water: clean(a.source_desc),
            county: clean(a.county), basin: clean(a.basin), priority: year(a.priority_date),
            rate_cfs: a.diversion_rate ?? null, pou_acres: a.pou_acre_total ?? null,
          },
        });
        total++;
      }
      log.dim(`  PODs: ${total}`);
      if (feats.length < PAGE && !j.exceededTransferLimit) break;
      offset += PAGE;
    }
    log.info(`Nevada PODs upserted: ${total}`);
    return { stats: { pods: total } };
  },
};

// --- helpers -------------------------------------------------------------
const clean = (s) => (s == null ? null : String(s).trim() || null);
const year = (ms) => (ms == null ? null : new Date(Number(ms)).getUTCFullYear());
const num = (v) => (v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));
