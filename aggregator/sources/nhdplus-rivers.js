// NHDPlus V2 river flowlines — the actual hydrography: major water systems as
// they descend from the mountains to the sea.
//
// Source: EPA WATERS "NHDPlus" map service (medium-resolution, 1:100k, national
// coverage) whose Network Flowline layer carries the NHDPlus value-added
// attributes. The ones we keep:
//   streamorder  Strahler order — our "major system" filter and the site's
//                line-width driver (headwaters thin, trunk rivers thick)
//   qe_ma        EROM gage-adjusted mean annual flow, cfs
//   totdasqkm    total upstream drainage area, km²
//   ftype        StreamRiver / CanalDitch / ArtificialPath / ...
//
// We take streamorder >= MIN_ORDER inside the atlas footprint (CA + OR, which
// necessarily also brackets NV — a bonus, since the atlas maps NV rights too).
// Order >= 4 keeps the mountain tributaries that feed the trunk rivers without
// dragging in every first-order creek (~50k of ~350k flowlines in the box).
//
// The dataset is static (NHDPlus V2 is finished data), so pages are fetched
// with cache 'prefer': the first run downloads ~25 pages; re-runs replay from
// the on-disk cache for free.
const ID = 'nhdplus-rivers';
const LAYER = 'rivers';

const MIN_ORDER = 4;
const PAGE = 2000; // service maxRecordCount
// Atlas footprint [west, south, east, north]: California + Oregon (+ Nevada between them).
const BBOX = '-124.6,32.4,-114.0,46.4';

const BASE = 'https://watersgeo.epa.gov/arcgis/rest/services/NHDPlus/NHDPlus/MapServer/2/query';

function pageUrl(offset) {
  const q = new URLSearchParams({
    where: `streamorder >= ${MIN_ORDER}`,
    geometry: BBOX,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'comid,gnis_name,streamorder,ftype,qe_ma,totdasqkm',
    returnGeometry: 'true',
    outSR: '4326',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    orderByFields: 'comid', // stable order makes pagination (and the cache) deterministic
    f: 'geojson',
  });
  return `${BASE}?${q}`;
}

export default {
  id: ID,
  title: 'Rivers & streams',
  layer: LAYER,
  description:
    'Major river systems (NHDPlus, Strahler order ≥ 4) — flow lines from the mountains down, drawn wider as rivers gather size.',
  style: { color: '#2b7cb5', cluster: false, kind: 'line' },
  exportProps: ['streamorder', 'ftype', 'qe_ma', 'totdasqkm'],

  async run({ store, http, log }) {
    // Gather every page before touching the store, so a mid-run failure can't
    // leave the layer half-loaded.
    const collected = [];
    for (let offset = 0; ; offset += PAGE) {
      const fc = await http.getJson(pageUrl(offset), { cache: 'prefer' });
      if (fc.error) throw new Error(`ArcGIS error: ${JSON.stringify(fc.error)}`);
      const feats = fc.features ?? [];
      collected.push(...feats);
      log.info(`rivers: page @${offset} -> ${feats.length} flowlines (total ${collected.length})`);
      if (feats.length < PAGE) break;
    }
    if (!collected.length) throw new Error('NHDPlus returned no flowlines');

    store.clearFeatures(ID);
    let kept = 0;
    for (const f of collected) {
      const p = f.properties ?? {};
      if (p.comid == null || !f.geometry) continue;
      store.feature({
        source: ID,
        layer: LAYER,
        external_id: p.comid,
        name: p.gnis_name || null,
        geometry: f.geometry,
        props: {
          streamorder: p.streamorder,
          ftype: p.ftype,
          // EROM uses large negative sentinels for "no estimate" — store null instead.
          qe_ma: p.qe_ma >= 0 ? p.qe_ma : null,
          totdasqkm: p.totdasqkm >= 0 ? p.totdasqkm : null,
        },
      });
      kept++;
    }

    log.info(`rivers: ${kept} flowlines (order >= ${MIN_ORDER}) stored`);
    return { stats: { flowlines: kept } };
  },
};
