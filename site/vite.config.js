import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// `static/` holds generated GeoJSON (npm run export) and is served at the site root,
// e.g. static/data/gauges.geojson -> /data/gauges.geojson
export default defineConfig({
  plugins: [svelte()],
  publicDir: 'static',
  server: { port: 5180 },
});
