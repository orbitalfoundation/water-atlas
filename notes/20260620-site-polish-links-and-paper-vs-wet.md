# Site polish — links + paper-vs-wet overview

**Date:** 2026-06-20
**Status:** Done, builds clean (`npm --prefix site run build`). Not yet redeployed — run
`deploy/deploy.sh` to push.

User asked to polish the public site with a few things. All landed in `site/src/lib/*` + `app.css`.

## What changed

1. **Links added** (3 places, so they're reachable from intro, deep-read, and persistent UI):
   - Source repo → `https://github.com/orbitalfoundation/water-atlas`
   - Initiative → `https://open-cubed.exe.xyz/` ("part of Open-Cubed")
   - Historic archive → `https://github.com/NewCaliforniaWaterAtlas` (the old org, code+data still up)
   - In: `Splash.svelte` credit row, `Faq.svelte` new "Links & source" section, `Sidebar.svelte`
     footer.

2. **Paper-water-vs-wet-water overview** — the old site
   (`NewCaliforniaWaterAtlas/ca-water-rights`) made the over-allocation gap obvious; ours only said
   "~5×" in passing. Added a **visual two-bar comparison** to `Splash.svelte` (`.gap` block in
   `app.css`): paper rights (~370M AF/yr, full-width orange) vs average river flow (~70M AF/yr, 19%
   blue) → the 5× gap is now *seen*, not just stated. FAQ "big idea" answer now carries the concrete
   numbers + football-field acre-foot analogy.

## Numbers & sourcing decision (important)

- The current site's **"~5×"** is now properly sourced to **Grantham & Viers, 2014** (Env. Research
  Letters, UC Davis): ~370 MAF/yr of appropriative rights vs ~70 MAF mean annual runoff. This is the
  canonical peer-reviewed citation for the over-allocation claim — better than inventing our own.
- The **original** atlas used **~250M claimed vs ~71M available (~3.5×)**, stated without inline
  citation on its live interactive (not in the repo — the repo's `index.html` is Lorem ipsum; real
  copy only ever rendered live, recoverable via Wayback `ca.statewater.org/water-rights`). FAQ now
  mentions both framings honestly rather than silently picking one.

## Scavenge findings (from the old `NewCaliforniaWaterAtlas` org — worth following up)

- **`data-water-rights/README.md`** is the goldmine: a ~200-field eWRIMS data dictionary with
  value-frequency tables (use codes, status, type counts) + sample geoJSON. **Lift this wholesale**
  when doing the **P1 CKAN join** (`20260620-current-todos.md`) — saves reverse-engineering eWRIMS
  field semantics.
- Reusable copy already partly borrowed: "face value vs actual use" distinction, football-field
  acre-foot analogy, Drucker "if you can't measure it" epigraph, 1979-Atlas lineage, Huey
  Johnson/Zetland endorsement quotes.
- Old data CSV/geoJSON dumps are 2012–2014 — useful only as schema/historical baseline; pull fresh
  from eWRIMS for anything current.
- Org provenance: Laci Videmsky + Chach Sikes / Resource Renewal Institute, funded by Patagonia,
  Ted Grantham (UC Davis) on data team — which is why Grantham & Viers is the natural citation.

## Files touched
- `site/src/lib/Splash.svelte` — gap visual + links
- `site/src/lib/Faq.svelte` — sourced numbers + "Links & source" section
- `site/src/lib/Sidebar.svelte` — footer links
- `site/src/app.css` — `.gap*` styles, footer link styles, `.credit.links`
