// US Drought Monitor — current conditions, clipped to the atlas's West Coast footprint.
// The USDM is a weekly (Thursday) consensus map of drought severity, published as
// national polygons by category D0–D4. We pull the live FeatureServer, keep only the
// polygon parts that fall in/around CA · OR · NV · WA, and store one feature per part.
//
// This is the atlas's first *polygon* layer. It's a snapshot, not a time series: each
// run replaces the prior week's polygons (clearFeatures) so nothing stale lingers.
const ID = 'us-drought';
const LAYER = 'drought';

// ArcGIS Feature service for the current USDM (national). f=geojson returns ready-to-use geometry.
const URL =
  'https://services5.arcgis.com/0OTVzJS4K09zlixn/arcgis/rest/services/USDM_current/FeatureServer/0/query' +
  '?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson';

// West-Coast-ish bounding box [west, south, east, north] (CA · OR · NV · WA). Used to drop
// polygon parts from the rest of the country — a cheap clip that keeps the map regional.
const WEST_BBOX = [-124.9, 32.4, -114.0, 49.05];

const DM = {
  0: 'D0 — Abnormally Dry',
  1: 'D1 — Moderate Drought',
  2: 'D2 — Severe Drought',
  3: 'D3 — Extreme Drought',
  4: 'D4 — Exceptional Drought',
};

export default {
  id: ID,
  title: 'US Drought Monitor (West)',
  layer: LAYER,
  description: 'Weekly drought severity (D0–D4) — current conditions, clipped to CA · OR · NV · WA.',
  style: { color: '#e6550d', cluster: false, kind: 'fill' },
  // Keep the export lean: only the category + valid date travel to the browser.
  exportProps: ['dm', 'dm_label', 'valid_date'],

  async run({ store, http, log }) {
    const fc = await http.getJson(URL, { cache: 'bypass' }); // weekly snapshot — never cache
    const feats = Array.isArray(fc?.features) ? fc.features : [];
    if (!feats.length) throw new Error('USDM returned no features');

    // Snapshot semantics: wipe last week before writing this week.
    store.clearFeatures(ID);

    let kept = 0;
    let part = 0;
    let validDate = null;
    for (const f of feats) {
      const dm = Number(f.properties?.dm ?? f.properties?.DM);
      if (!Number.isFinite(dm)) continue;
      validDate ??= normDate(f.properties?.ValidStart ?? f.properties?.MapDate);

      for (const poly of explode(f.geometry)) {
        if (!intersectsWest(poly)) continue; // drop out-of-region parts
        store.feature({
          source: ID, layer: LAYER, external_id: `${dm}-${part++}`,
          name: DM[dm] ?? `D${dm}`,
          geometry: { type: 'Polygon', coordinates: poly },
          props: { dm, dm_label: DM[dm] ?? `D${dm}`, valid_date: validDate },
        });
        kept++;
      }
    }

    log.info(`drought: ${kept} West Coast polygons across D0–D4 (valid ${validDate ?? 'unknown'})`);
    return { cursor: validDate, stats: { polygons: kept, valid: validDate } };
  },
};

// --- helpers -------------------------------------------------------------

// Normalize a geometry to a list of Polygon coordinate arrays (each: [ring, ...holes]).
function explode(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

// True if a polygon's bounding box overlaps the West Coast footprint. Outer ring is coords[0].
function intersectsWest(poly) {
  const ring = poly[0];
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [x, y] of ring) {
    if (x < west) west = x; if (x > east) east = x;
    if (y < south) south = y; if (y > north) north = y;
  }
  const [cw, cs, ce, cn] = WEST_BBOX;
  return !(east < cw || west > ce || north < cs || south > cn);
}

// USDM Date arrives as an epoch-ms number or a YYYYMMDD-ish string; normalize to YYYY-MM-DD.
function normDate(d) {
  if (d == null) return null;
  const s = String(d);
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{12,}$/.test(s)) return new Date(Number(s)).toISOString().slice(0, 10);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
