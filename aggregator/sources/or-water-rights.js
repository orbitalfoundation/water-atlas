// Oregon water rights — Points of Diversion from OWRD's WRIS (Water Rights Information System).
// Oregon's data is richer than California's eWRIMS: each POD already carries owner, use, priority
// date, and the granted amount (cfs / acre-feet) — the very fields CA needs a separate join for.
// The service splits PODs into 5 point layers by source type; we pull all five into one layer.
// Full snapshot each run: clearFeatures() wipes the prior load so nothing stale lingers.
const ID = 'or-water-rights';
const LAYER = 'waterrights-or';
const BASE = 'https://gis.wrd.state.or.us/server/rest/services/dynamic/PODs_By_Source_WGS84/FeatureServer';
const PAGE = 2000; // server maxRecordCount
const SUBLAYERS = [[0, 'Reservoir'], [1, 'Sump'], [2, 'Spring'], [3, 'Stream'], [4, 'Well']];
const FIELDS = [
  'pod_display_short', 'wr_type', 'name_last', 'name_first', 'name_company',
  'use_code_description', 'source', 'stream_name', 'priority_date', 'rate_cfs', 'acre_feet',
].join(',');

export default {
  id: ID,
  title: 'Oregon water rights — points of diversion (OWRD)',
  layer: LAYER,
  description: 'Permitted points of diversion across Oregon, with owner, use, priority & amount.',
  // hidden: large out-of-state layer — off by default, lazy-loaded on first toggle (51 MB).
  style: { color: '#1b9e77', cluster: true, kind: 'right', hidden: true },
  exportProps: ['owner', 'use', 'status', 'source_water', 'priority', 'rate_cfs', 'acre_feet'],

  async run({ store, http, log }) {
    store.clearFeatures(ID); // full refresh; uniqueness is per-run, so no stable business key needed
    let total = 0;
    for (const [layerId, srcType] of SUBLAYERS) {
      let offset = 0;
      for (;;) {
        const url = `${BASE}/${layerId}/query?where=1%3D1&outFields=${FIELDS}` +
          `&returnGeometry=true&outSR=4326&orderByFields=OBJECTID` +
          `&resultOffset=${offset}&resultRecordCount=${PAGE}&f=json`;
        const j = await http.getJson(url);
        const feats = j.features || [];
        if (!feats.length) break;
        for (const f of feats) {
          const a = f.attributes || {};
          const lon = num(f.geometry?.x);
          const lat = num(f.geometry?.y);
          if (lat === null || lon === null) continue;
          store.feature({
            source: ID, layer: LAYER, external_id: total, name: clean(a.pod_display_short),
            lat, lon,
            props: {
              owner: owner(a), use: clean(a.use_code_description), status: clean(a.wr_type),
              source_water: clean(a.stream_name || a.source), source_type: srcType,
              priority: year(a.priority_date), rate_cfs: a.rate_cfs ?? null, acre_feet: a.acre_feet ?? null,
            },
          });
          total++;
        }
        log.dim(`  ${srcType}: ${total} PODs`);
        if (feats.length < PAGE && !j.exceededTransferLimit) break;
        offset += PAGE;
      }
    }
    log.info(`Oregon PODs upserted: ${total}`);
    return { stats: { pods: total } };
  },
};

// --- helpers -------------------------------------------------------------
const clean = (s) => (s == null ? null : String(s).trim() || null);
const owner = (a) =>
  clean(a.name_company) || clean([a.name_first, a.name_last].filter(Boolean).join(' ')) || null;
const year = (ms) => (ms == null ? null : new Date(Number(ms)).getUTCFullYear());
const num = (v) => (v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));
