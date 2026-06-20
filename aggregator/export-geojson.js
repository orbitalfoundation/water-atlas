#!/usr/bin/env node
// Exports the SQLite store to static GeoJSON the site can load directly:
//   site/static/data/<layer>.geojson   one FeatureCollection per layer (latest obs folded in)
//   site/static/data/layers.json       manifest (title, style, count) so the UI builds itself
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './core/db.js';
import { loadSources } from './core/registry.js';
import { makeLog } from './core/log.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = join(root, 'data', 'water.db');
const OUT_DIR = join(root, 'site', 'static', 'data');
const log = makeLog('export');
const round5 = (n) => Math.round(n * 1e5) / 1e5; // ~1 m precision, much smaller files
// Round every coordinate in an arbitrarily-nested GeoJSON coordinate array (Point..MultiPolygon).
const roundCoords = (c) => (typeof c[0] === 'number' ? c.map(round5) : c.map(roundCoords));

const db = openDb(DB_PATH);
const sources = await loadSources();
const sourceByLayer = new Map(sources.map((s) => [s.layer, s]));

// Pull the single most-recent observation per (feature, variable) in one pass.
const latestByFeature = new Map(); // key: "source|external_id" -> { variable: {value, unit, observed_at} }
for (const o of db.prepare(`
  SELECT source, feature_external_id AS fid, variable, value, unit, observed_at FROM (
    SELECT *, ROW_NUMBER() OVER (
      PARTITION BY source, feature_external_id, variable ORDER BY observed_at DESC) AS rn
    FROM observations)
  WHERE rn = 1`).all()) {
  const key = `${o.source}|${o.fid}`;
  if (!latestByFeature.has(key)) latestByFeature.set(key, {});
  latestByFeature.get(key)[o.variable] = { value: o.value, unit: o.unit, at: o.observed_at };
}

mkdirSync(OUT_DIR, { recursive: true });
const manifest = [];
const layers = [...new Set(sources.map((s) => s.layer))];

for (const layer of layers) {
  const src = sourceByLayer.get(layer);
  const allow = src?.exportProps ?? null; // optional allowlist keeps dense layers lean
  // A feature is mappable if it carries an explicit geometry (polygons) or a lat/lon point.
  const rows = db.prepare(
    'SELECT * FROM features WHERE layer = ? AND (geometry IS NOT NULL OR (lat IS NOT NULL AND lon IS NOT NULL))'
  ).all(layer);
  const features = rows.map((r) => {
    const raw = r.props ? JSON.parse(r.props) : {};
    const kept = allow ? Object.fromEntries(allow.filter((k) => k in raw).map((k) => [k, raw[k]])) : raw;
    const props = { id: r.external_id, name: r.name, ...kept };
    const latest = latestByFeature.get(`${r.source}|${r.external_id}`);
    if (latest) for (const [variable, o] of Object.entries(latest)) {
      props[variable] = o.value;
      props[`${variable}_unit`] = o.unit;
      props[`${variable}_at`] = o.at;
    }
    const geometry = r.geometry
      ? (() => { const g = JSON.parse(r.geometry); return { ...g, coordinates: roundCoords(g.coordinates) }; })()
      : { type: 'Point', coordinates: [round5(r.lon), round5(r.lat)] };
    return { type: 'Feature', geometry, properties: props };
  });

  const file = `${layer}.geojson`;
  writeFileSync(join(OUT_DIR, file), JSON.stringify({ type: 'FeatureCollection', features }));
  manifest.push({
    layer, source: src?.id, title: src?.title ?? layer, description: src?.description ?? '',
    color: src?.style?.color ?? '#3aa0d1', cluster: src?.style?.cluster ?? false,
    kind: src?.style?.kind ?? 'point', count: features.length, file,
  });
  log.ok(`${layer}: ${features.length} features -> ${file}`);
}

writeFileSync(join(OUT_DIR, 'layers.json'), JSON.stringify(manifest, null, 2));
db.close();
log.ok(`wrote layers.json (${manifest.length} layers)`);
