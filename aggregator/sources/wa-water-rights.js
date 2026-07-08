// Washington water rights — verified water right device points from the WA
// Department of Ecology's hosted "WR" feature service (the GIS side of their
// Water Rights Tracking System / GWIS).
//
// Caveat (see notes/20260708-rivers-layer-west-coast-scouting.md): unlike
// Oregon's WRIS, the GIS layer is attribute-thin — point id, device type, and a
// location code only. Owner / use / priority / quantity live in Ecology's WRTS
// database and would need a separate download + join; the shared rights popup
// already adapts to whatever fields a state provides, so we ship sparse first.
// Layer 5 = *verified* device points (165k); layer 4 (unverified, 76k) is
// deliberately left out.
const ID = 'wa-water-rights';
const LAYER = 'waterrights-wa';
const URL = 'https://services.arcgis.com/6lCKYNJLvwTXqrmp/arcgis/rest/services/WR/FeatureServer/5/query';
const PAGE = 2000; // server maxRecordCount

// Ecology D_Point_Type_CD -> plain English (dominant codes; others pass through raw).
const TYPE_LABEL = {
  WL: 'Well (groundwater)',
  HW: 'Headworks (surface water)',
  PM: 'Pump',
  GC: 'Gravity collector',
  RD: 'Radial collector well',
  MW: 'Multiple wells',
  ID: 'Irrigation ditch',
};

export default {
  id: ID,
  title: 'Washington water rights — points of diversion (Ecology)',
  layer: LAYER,
  description: 'Verified water right device points across Washington (type + location; Ecology publishes detailed attributes separately).',
  // hidden: large out-of-state layer — off by default, lazy-loaded on first toggle.
  style: { color: '#e7298a', cluster: true, kind: 'right', hidden: true },
  exportProps: ['point_type'],

  async run({ store, http, log }) {
    store.clearFeatures(ID); // full snapshot each run
    let total = 0;
    for (let offset = 0; ; offset += PAGE) {
      const url = `${URL}?where=1%3D1&outFields=D_Point_ID,D_Point_Type_CD,Location_CD` +
        `&returnGeometry=true&outSR=4326&orderByFields=OBJECTID` +
        `&resultOffset=${offset}&resultRecordCount=${PAGE}&f=json`;
      const j = await http.getJson(url);
      if (j.error) throw new Error(`ArcGIS error: ${JSON.stringify(j.error)}`);
      const feats = j.features || [];
      if (!feats.length) break;
      for (const f of feats) {
        const a = f.attributes || {};
        const lon = Number(f.geometry?.x);
        const lat = Number(f.geometry?.y);
        if (!Number.isFinite(lon) || !Number.isFinite(lat) || a.D_Point_ID == null) continue;
        store.feature({
          source: ID, layer: LAYER, external_id: a.D_Point_ID, name: null, lat, lon,
          props: { point_type: TYPE_LABEL[a.D_Point_Type_CD] ?? a.D_Point_Type_CD ?? null },
        });
        total++;
      }
      if (offset % 20000 === 0) log.dim(`  WA device points so far: ${total}`);
      if (feats.length < PAGE) break;
    }
    if (!total) throw new Error('Ecology WR service returned no device points');
    log.info(`WA verified water right device points: ${total}`);
    return { stats: { points: total } };
  },
};
