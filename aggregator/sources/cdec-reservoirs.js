// California reservoir storage from CDEC (California Data Exchange Center).
//   storage time-series  -> observations (storage_af), sensor 15, daily
//   station coordinates  -> resolved once from staMeta HTML, then served from cache
//   capacity             -> from the bundled seed, to compute % full
// Incremental: resumes from the last observed date (watermark in source_state.cursor).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ID = 'cdec-reservoirs';
const LAYER = 'reservoirs';
const SENSOR_STORAGE = 15; // CDEC sensor number: reservoir storage, acre-feet
const here = dirname(fileURLToPath(import.meta.url));
const SEED = JSON.parse(readFileSync(join(here, 'cdec-reservoirs.seed.json'), 'utf8'));

export default {
  id: ID,
  title: 'California reservoir storage (CDEC)',
  layer: LAYER,
  description: 'Daily storage (AF) + % of capacity for major California reservoirs.',
  style: { color: '#08519c', cluster: false, kind: 'reservoir' },

  async run({ store, http, log, cursor }) {
    const start = cursor || isoDaysAgo(45); // resume from watermark, else backfill ~6 weeks
    const end = isoToday();
    let mapped = 0;
    let obsCount = 0;
    let maxDate = cursor || '';

    for (const r of SEED) {
      const coords = await resolveCoords(http, r.code).catch(() => null);
      const rows = await fetchStorage(http, r.code, start, end)
        .catch((e) => (log.warn(`${r.code}: ${e.message}`), []));

      if (!coords) { log.warn(`${r.code} ${r.name}: no coordinates, skipped`); continue; }

      const last = rows.at(-1);
      const pctFull = last && r.capacity_af ? round1((100 * last.value) / r.capacity_af) : null;
      store.feature({
        source: ID, layer: LAYER, external_id: r.code, name: r.name,
        lat: coords.lat, lon: coords.lon,
        props: {
          capacity_af: r.capacity_af ?? null,
          latest_storage_af: last?.value ?? null,
          latest_date: last?.date ?? null,
          pct_full: pctFull,
        },
      });
      mapped++;

      for (const row of rows) {
        store.observation({
          source: ID, feature_external_id: r.code, variable: 'storage_af',
          value: row.value, unit: 'AF', observed_at: row.date,
        });
        if (row.date > maxDate) maxDate = row.date;
        obsCount++;
      }
      log.dim(`  ${r.code} ${r.name}: ${rows.length} obs${pctFull != null ? `, ${pctFull}% full` : ''}`);
    }

    log.info(`reservoirs mapped: ${mapped}, storage obs: ${obsCount}`);
    return { cursor: maxDate || cursor, stats: { reservoirs: mapped, obs: obsCount } };
  },
};

// --- helpers -------------------------------------------------------------

async function fetchStorage(http, code, start, end) {
  const url = `https://cdec.water.ca.gov/dynamicapp/req/JSONDataServlet?Stations=${code}` +
    `&SensorNums=${SENSOR_STORAGE}&dur_code=D&start_date=${start}&end_date=${end}`;
  const data = await http.getJson(url);
  const out = [];
  for (const d of Array.isArray(data) ? data : []) {
    const v = Number(d.value);
    if (!Number.isFinite(v) || v <= -9000) continue; // CDEC uses sentinels for missing
    out.push({ date: normDate(d.date), value: v });
  }
  return out;
}

// staMeta is HTML; coords rarely change, so cache aggressively ('prefer').
async function resolveCoords(http, code) {
  const html = await http.fetchText(
    `https://cdec.water.ca.gov/dynamicapp/staMeta?station_id=${code}`, { cache: 'prefer' });
  const text = html.replace(/<[^>]+>/g, '|').replace(/&deg;|&#176;?|&nbsp;/gi, ' ').replace(/\s+/g, ' ');
  const grab = (label) => {
    const m = text.match(new RegExp(`${label}\\s*\\|+\\s*(-?[0-9]+\\.?[0-9]*)`, 'i'));
    return m ? parseFloat(m[1]) : null;
  };
  const lat = grab('Latitude');
  const lon = grab('Longitude');
  return lat && lon ? { lat, lon } : null;
}

const pad = (n) => String(n).padStart(2, '0');
const isoToday = () => new Date().toISOString().slice(0, 10);
const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const round1 = (n) => Math.round(n * 10) / 10;
// CDEC dates come unpadded, e.g. "2026-6-10 00:00" -> "2026-06-10"
function normDate(s) {
  const [y, m, d] = String(s).split(' ')[0].split('-');
  return `${y}-${pad(m)}-${pad(d)}`;
}
