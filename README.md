# Water Atlas

See live site here: [New New California Water Atlas](https://water-atlas.exe.xyz) 

California's water, made legible — built entirely from **open public data**, and rebuildable by
anyone from a `git clone`. A fresh take on the [New California Water Atlas](https://longnow.org/ideas/the-new-california-water-atlas/)
(≈2013), which went offline — this version is small, open, and durable on purpose.

It does two things:

1. **Aggregates** interesting water datasets from public APIs into a local SQLite store
   (idempotent, resumable, polite).
2. **Surfaces** them on an open-source map (Svelte 5 + MapLibre, keyless basemap).

## What's in v1 (live data, verified 2026-06-19)

| Layer | Source | Count |
|---|---|---|
| Stream gauges + live flow | USGS Water Data OGC API | 6,733 sites |
| Reservoir storage + % full | California CDEC | 22 major reservoirs |
| Water rights (points of diversion) | State Water Board eWRIMS | 63,990 PODs |

The point of putting these together: **paper water vs wet water** — California has granted water
rights totaling roughly 5× the water its rivers actually carry. Overlay the rights on the flow and
the gap is visible.

## Quickstart

```bash
# collect into data/water.db  (re-runnable; resumes from where it left off)
npm run aggregate -- --all
npm run list                 # see available sources

# flatten SQLite -> site/static/data/*.geojson + layers.json
npm run export

# run the map
cd site && npm install && npm run dev      # http://localhost:5180
```

Requires Node ≥ 22 (uses the built-in `node:sqlite` — no native deps). No API keys for v1.

## Layout

- `aggregator/` — the collector. `core/` is reusable machinery; `sources/*.js` is one small file per
  dataset. Adding a source = dropping in one file (see below).
- `site/` — the Svelte 5 + MapLibre map. Builds to a static site.
- `notes/` — design notes & the data survey. Start with
  [`notes/20260619-architecture.md`](notes/20260619-architecture.md) and
  [`notes/20260619-initial-survey.md`](notes/20260619-initial-survey.md).

## Add a data source

Drop a file in `aggregator/sources/`:

```js
export default {
  id: 'us-drought', title: 'US Drought Monitor', layer: 'drought',
  style: { color: '#d73027', kind: 'point' },
  async run({ store, http, log, cursor }) {
    const data = await http.getJson('https://…');
    for (const d of data) store.feature({ source: 'us-drought', layer: 'drought',
      external_id: d.id, name: d.name, lat: d.lat, lon: d.lon, props: { … } });
    return { stats: { count: data.length } };
  },
};
```

It's auto-discovered (`npm run list`), collected (`npm run aggregate -- us-drought`), and appears on
the map after `npm run export`. Verified next-up sources are listed in the survey note.

## Data & license

All data is public (US public domain for USGS; CA state open data for CDEC/eWRIMS). Reservoir
locations from CDEC; capacities are curated public figures. Basemap © OpenStreetMap contributors ©
CARTO. This repo is the plumbing, not the data.
