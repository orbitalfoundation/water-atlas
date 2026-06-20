#!/usr/bin/env node
// Aggregator CLI.
//   node aggregator/cli.js --list            list available sources
//   node aggregator/cli.js usgs-sites        run one (or several) sources by id
//   node aggregator/cli.js --all             run every source
// Re-running is safe: upserts are idempotent and each source resumes from its watermark.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, makeStore } from './core/db.js';
import { makeState } from './core/state.js';
import { createHttp } from './core/http.js';
import { loadSources, getSource } from './core/registry.js';
import { runSource } from './core/run.js';
import { makeLog } from './core/log.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = join(root, 'data', 'water.db');
const CACHE_DIR = join(root, 'data', 'cache');
const USER_AGENT = 'water-atlas/0.0.1 (https://github.com/NewCaliforniaWaterAtlas; contact: anselm@gmail.com)';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const ids = args.filter((a) => !a.startsWith('--'));
const log = makeLog();

const all = await loadSources();

if (flags.has('--list') || (ids.length === 0 && !flags.has('--all'))) {
  log.info('Available sources:');
  for (const s of all) process.stderr.write(`  ${s.id.padEnd(20)} ${s.title}\n`);
  process.stderr.write('\nUsage: node aggregator/cli.js <source-id...> | --all | --list\n');
  process.exit(0);
}

const selected = flags.has('--all')
  ? all
  : (await Promise.all(ids.map(getSource))).filter((s, i) => s || log.error(`unknown source: ${ids[i]}`));

const db = openDb(DB_PATH);
const store = makeStore(db);
const state = makeState(db);

for (const source of selected) {
  const prior = state.read(source.id);
  const scoped = makeLog(source.id);
  const http = createHttp({ cacheDir: CACHE_DIR, userAgent: USER_AGENT, log: scoped });
  await runSource(source, { db, store, state, http, log: scoped, cursor: prior?.cursor ?? null, root });
}

db.close();
log.ok('done.');
