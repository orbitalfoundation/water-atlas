// Recyclable MapLibre helper: a keyless basemap + a generic "manifest entry -> map layers" loader.
// Knows three point "kinds" (gauge / reservoir / right); everything else is data-driven from layers.json.
import maplibregl from 'maplibre-gl';
import { fmtAf, fmtCfs, fmtPct, fmtFlowLabel } from './format.js';

// Draw order, bottom -> top (drought wash at the bottom, then dense points, big reservoirs on top).
export const KIND_ORDER = ['gauge', 'reservoir', 'right', 'fill'];

// Official US Drought Monitor palette, D0 (abnormally dry) -> D4 (exceptional).
const DM_COLORS = ['#ffff00', '#fcd37f', '#ffaa00', '#e60000', '#730000'];

// Keyless raster basemap (CARTO light + OSM data). No API token required.
const BASEMAP_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
};

export function createMap(container, { center = [-119.4, 37.4], zoom = 5.4 } = {}) {
  const map = new maplibregl.Map({ container, style: BASEMAP_STYLE, center, zoom });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
  map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }));
  return map;
}

// Adds one GeoJSON source + 1–3 layers for a manifest entry. Sub-layer ids: `${layer}-{clusters,count,point}`.
export function addLayerFromManifest(map, entry) {
  const srcId = `src-${entry.layer}`;
  map.addSource(srcId, {
    type: 'geojson',
    data: `data/${entry.file}`,
    cluster: !!entry.cluster,
    clusterRadius: 25,
    clusterMaxZoom: 6,
  });

  if (entry.kind === 'fill') {
    map.addLayer({
      id: `${entry.layer}-fill`, type: 'fill', source: srcId,
      paint: {
        'fill-color': ['match', ['get', 'dm'],
          0, DM_COLORS[0], 1, DM_COLORS[1], 2, DM_COLORS[2], 3, DM_COLORS[3], 4, DM_COLORS[4],
          '#cccccc'],
        'fill-opacity': 0.35,
      },
    });
    map.addLayer({
      id: `${entry.layer}-outline`, type: 'line', source: srcId,
      paint: { 'line-color': '#7a3b00', 'line-width': 0.4, 'line-opacity': 0.5 },
    });
    bindPopup(map, `${entry.layer}-fill`, entry);
    return;
  } else if (entry.cluster) {
    map.addLayer({
      id: `${entry.layer}-clusters`, type: 'circle', source: srcId, filter: ['has', 'point_count'],
      paint: {
        'circle-color': entry.color, 'circle-opacity': 0.6,
        'circle-radius': ['step', ['get', 'point_count'], 12, 100, 18, 1000, 26, 5000, 34],
      },
    });
    map.addLayer({
      id: `${entry.layer}-count`, type: 'symbol', source: srcId, filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11 },
      paint: { 'text-color': '#5a2208' },
    });
    map.addLayer({
      id: `${entry.layer}-point`, type: 'circle', source: srcId, filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': entry.color, 'circle-radius': 3.5, 'circle-opacity': 0.6,

      },
    });
    map.on('click', `${entry.layer}-clusters`, (e) => {
      const f = map.queryRenderedFeatures(e.point, { layers: [`${entry.layer}-clusters`] })[0];
      map.getSource(srcId).getClusterExpansionZoom(f.properties.cluster_id)
        .then((z) => map.easeTo({ center: f.geometry.coordinates, zoom: z }));
    });
    cursorPointer(map, `${entry.layer}-clusters`);
  } else if (entry.kind === 'reservoir') {
    map.addLayer({
      id: `${entry.layer}-point`, type: 'circle', source: srcId,
      paint: {
        // size by storage (sqrt), color by % full (red empty -> green full)
        'circle-radius': ['interpolate', ['linear'], ['sqrt', ['coalesce', ['get', 'storage_af'], ['get', 'latest_storage_af'], 0]],
          0, 6, 500, 12, 1500, 24, 2150, 36],
        'circle-color': ['interpolate', ['linear'], ['coalesce', ['get', 'pct_full'], 50],
          0, '#d73027', 30, '#fc8d59', 50, '#fee08b', 75, '#91cf60', 100, '#1a9850'],
        'circle-opacity': 0.6, 'circle-stroke-width': 0,
      },
    });
    cursorPointer(map, `${entry.layer}-point`);
  } else {
    map.addLayer({
      id: `${entry.layer}-point`, type: 'circle', source: srcId,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2.5, 10, 5],
        'circle-color': entry.color, 'circle-opacity': 0.6,
      },
    });
    cursorPointer(map, `${entry.layer}-point`);
  }

  bindPopup(map, `${entry.layer}-point`, entry);
}

export function setLayerVisibility(map, entry, visible) {
  for (const suffix of ['clusters', 'count', 'point', 'fill', 'outline']) {
    const id = `${entry.layer}-${suffix}`;
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
}

// --- internals -----------------------------------------------------------

function bindPopup(map, layerId, entry) {
  map.on('click', layerId, (e) => {
    const f = e.features?.[0];
    if (!f) return;
    // Points carry a single coordinate; polygons/lines don't, so anchor at the click.
    const at = f.geometry?.type === 'Point' ? f.geometry.coordinates : e.lngLat;
    new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
      .setLngLat(at)
      .setHTML(popupHtml(entry, f.properties))
      .addTo(map);
  });
  cursorPointer(map, layerId);
}

// Per-source footer label for the rights popup (the agency of record).
const RIGHTS_AGENCY = {
  'ca-water-rights': 'eWRIMS · CA State Water Board',
  'or-water-rights': 'OWRD · Oregon',
  'nv-water-rights': 'NDWR · Nevada',
};

function cursorPointer(map, layerId) {
  map.on('mouseenter', layerId, () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', layerId, () => (map.getCanvas().style.cursor = ''));
}

// Reservoir color at a given % full, matching the map's interpolation.
function reservoirColor(pct) {
  const p = Number(pct) || 50;
  if (p < 30) return '#d73027';
  if (p < 50) return '#fc8d59';
  if (p < 75) return '#fee08b';
  return '#1a9850';
}

function popupHtml(entry, p) {
  const kind = entry.kind;
  if (kind === 'fill') {
    const dm = Number(p.dm ?? 0);
    const color = DM_COLORS[dm] ?? '#ccc';
    return `<div class="pop"><h3><span class="pop-dot" style="background:${color}"></span>${esc(p.dm_label ?? p.name)}</h3>
      <small>US Drought Monitor${p.valid_date ? ' · valid ' + esc(p.valid_date) : ''}</small></div>`;
  }
  if (kind === 'reservoir') {
    const color = reservoirColor(p.pct_full);
    return `<div class="pop"><h3><span class="pop-dot" style="background:${color}"></span>${esc(p.name)}</h3>
      <div class="pop-big">${fmtPct(p.pct_full)} full</div>
      <table><tr><td>Storage</td><td>${fmtAf(p.storage_af ?? p.latest_storage_af)}</td></tr>
      <tr><td>Capacity</td><td>${fmtAf(p.capacity_af)}</td></tr></table>
      <small>as of ${esc(p.storage_af_at ?? p.latest_date ?? '—')} · CDEC</small></div>`;
  }
  if (kind === 'gauge')
    return `<div class="pop"><h3><span class="pop-dot" style="background:${entry.color}"></span>${esc(p.name)}</h3>
      <div class="pop-big">${fmtCfs(p.discharge_cfs)}</div>
      <div class="pop-label">${fmtFlowLabel(p.discharge_cfs)}</div>
      <table><tr><td>County</td><td>${esc(p.county) || '—'}</td></tr>
      <tr><td>Site</td><td>${esc(p.id)}</td></tr></table>
      <small>${p.discharge_cfs_at ? 'as of ' + esc(p.discharge_cfs_at) + ' · ' : ''}USGS</small></div>`;
  // Rights (CA / OR / NV): adaptive — show only the fields a given state actually provides.
  const id = p.appl_id ?? p.app ?? p.id ?? p.name;
  const hasVolume = p.acre_feet != null || p.rate_cfs != null;
  const heroValue = p.acre_feet != null ? fmtAf(p.acre_feet) : p.rate_cfs != null ? fmtCfs(p.rate_cfs) : null;
  const rows = [
    ['Owner', p.owner],
    ['Use', p.use],
    ['Status', p.status],
    ['Priority', p.priority],
    hasVolume && p.acre_feet != null && p.rate_cfs != null ? ['Rate', `${p.rate_cfs} cfs`] : null,
    hasVolume && p.acre_feet != null && p.rate_cfs != null ? ['Amount', fmtAf(p.acre_feet)] : null,
    ['Place of use', p.pou_acres != null ? `${p.pou_acres.toLocaleString()} ac` : null],
    ['Source', p.source_water],
    ['County', p.county],
    ['Watershed', p.watershed],
    ['Basin', p.basin],
  ].filter((r) => r != null && r[1] != null && r[1] !== '');
  return `<div class="pop"><h3><span class="pop-dot" style="background:${entry.color}"></span>Water right ${esc(id)}</h3>
    ${hasVolume ? `<div class="pop-big">${heroValue}</div>` : '<div class="pop-note">Volume not available in this dataset</div>'}
    <table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
    <small>${esc(RIGHTS_AGENCY[entry.source] ?? 'point of diversion')}</small></div>`;
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
