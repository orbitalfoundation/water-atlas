import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Build date (UTC, YYYY-MM-DD) stamped at build time so the live site reveals which
// version is deployed. Surfaced in the FAQ footer via __BUILD_DATE__.
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// `static/` holds generated GeoJSON (npm run export) and is served at the site root,
// e.g. static/data/gauges.geojson -> /data/gauges.geojson
export default defineConfig({
  plugins: [svelte()],
  publicDir: 'static',
  server: { port: 5180 },
  define: {
    __BUILD_DATE__: JSON.stringify(BUILD_DATE),
  },
});
