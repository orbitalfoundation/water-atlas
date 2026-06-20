// SQLite via Node's built-in driver (no native deps). Generic, recyclable schema:
//   features      — one mappable point per (source, external_id)
//   observations  — time-stamped values attached to a feature (storage, flow, SWE, ...)
//   source_state  — per-source watermark + last run status (resumable, idempotent runs)
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS features (
  source       TEXT NOT NULL,
  layer        TEXT NOT NULL,
  external_id  TEXT NOT NULL,
  name         TEXT,
  lat          REAL,
  lon          REAL,
  props        TEXT,                 -- JSON blob of source-specific fields
  fetched_at   TEXT NOT NULL,
  PRIMARY KEY (source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_features_layer ON features(layer);

CREATE TABLE IF NOT EXISTS observations (
  source              TEXT NOT NULL,
  feature_external_id TEXT NOT NULL,
  variable            TEXT NOT NULL, -- e.g. storage_af, discharge_cfs, swe_in
  value               REAL,
  unit                TEXT,
  observed_at         TEXT NOT NULL, -- ISO date/time of the measurement
  fetched_at          TEXT NOT NULL,
  PRIMARY KEY (source, feature_external_id, variable, observed_at)
);
CREATE INDEX IF NOT EXISTS idx_obs_feature ON observations(source, feature_external_id, variable);

CREATE TABLE IF NOT EXISTS source_state (
  source       TEXT PRIMARY KEY,
  cursor       TEXT,                 -- watermark: pagination cursor or last observed date
  last_run_at  TEXT,
  last_status  TEXT,
  stats        TEXT                  -- JSON: per-run counters
);
`;

export function openDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

// Prepared-statement upsert helpers. Call sites stay short; policy (idempotency) lives here.
export function makeStore(db) {
  const upFeature = db.prepare(`
    INSERT INTO features (source, layer, external_id, name, lat, lon, props, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source, external_id) DO UPDATE SET
      layer = excluded.layer, name = excluded.name, lat = excluded.lat,
      lon = excluded.lon, props = excluded.props, fetched_at = excluded.fetched_at`);

  const upObs = db.prepare(`
    INSERT INTO observations
      (source, feature_external_id, variable, value, unit, observed_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source, feature_external_id, variable, observed_at) DO UPDATE SET
      value = excluded.value, unit = excluded.unit, fetched_at = excluded.fetched_at`);

  const now = () => new Date().toISOString();

  return {
    feature(f) {
      upFeature.run(f.source, f.layer, String(f.external_id), f.name ?? null,
        num(f.lat), num(f.lon), f.props ? JSON.stringify(f.props) : null, now());
    },
    observation(o) {
      upObs.run(o.source, String(o.feature_external_id), o.variable,
        num(o.value), o.unit ?? null, o.observed_at, now());
    },
  };
}

// SQLite only binds null/number/bigint/string/Uint8Array — coerce undefined/NaN to null.
const num = (v) => (v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));
