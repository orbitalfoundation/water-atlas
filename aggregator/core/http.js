// Polite HTTP client: global rate-limit, timeout, exponential backoff + retry on 429/5xx/network,
// and an optional on-disk response cache (keyed by URL hash) for provenance + cheap re-runs.
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createHttp({
  cacheDir,
  userAgent = 'water-atlas/0.0.1',
  minIntervalMs = 250, // be a good citizen: space out requests
  retries = 4,
  timeoutMs = 30000,
  log,
} = {}) {
  if (cacheDir) mkdirSync(cacheDir, { recursive: true });
  let lastAt = 0;

  async function throttle() {
    const wait = lastAt + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastAt = Date.now();
  }

  const cachePath = (url) =>
    join(cacheDir, `${createHash('sha256').update(url).digest('hex').slice(0, 32)}.cache`);

  // cache: 'refresh' (fetch + write, default) | 'prefer' (use cache if present) | 'bypass' (no cache)
  async function fetchText(url, { cache = 'refresh' } = {}) {
    const cp = cacheDir ? cachePath(url) : null;
    if (cp && cache === 'prefer' && existsSync(cp)) return readFileSync(cp, 'utf8');

    for (let attempt = 1; ; attempt++) {
      await throttle();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        const res = await fetch(url, {
          headers: { 'User-Agent': userAgent, Accept: '*/*' },
          signal: ctrl.signal,
        }).finally(() => clearTimeout(timer));

        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { fatal: true });

        const text = await res.text();
        if (cp && cache !== 'bypass') writeFileSync(cp, text);
        return text;
      } catch (err) {
        if (err.fatal || attempt > retries) throw err;
        const backoff = Math.min(15000, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
        log?.warn(`fetch failed (${err.message}); retry ${attempt}/${retries} in ${backoff}ms`);
        await sleep(backoff);
      }
    }
  }

  const getJson = async (url, opts) => JSON.parse(await fetchText(url, opts));

  return { fetchText, getJson };
}
