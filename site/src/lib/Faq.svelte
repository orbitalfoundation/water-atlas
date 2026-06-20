<script>
  let { layers = [], onClose } = $props();
  const rights = $derived(layers.find((l) => l.layer === 'waterrights')?.count ?? 0);
  const gauges = $derived(layers.find((l) => l.layer === 'gauges')?.count ?? 0);
  const reservoirs = $derived(layers.find((l) => l.layer === 'reservoirs')?.count ?? 0);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="faq-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onClose()}>
  <div class="faq" role="dialog" aria-modal="true" aria-label="Frequently asked questions">
    <button class="x" onclick={onClose} aria-label="Close">×</button>

    <h1>About &amp; FAQ</h1>
    <p class="lede">
      What this is, why it exists, and how to use it. Water is shared, contested, and badly
      documented in public — this atlas tries to make a little of it legible.
    </p>

    <!-- ───────────────────────── ORIGINS ───────────────────────── -->
    <h2>Where this came from</h2>

    <details open>
      <summary>What is the Water Atlas?</summary>
      <p>
        An open map of California's water, built entirely from public data and rebuildable by
        anyone from a single command. Today it shows
        {gauges.toLocaleString()} stream gauges, {reservoirs.toLocaleString()} major reservoirs, and
        {rights.toLocaleString()} water-rights points of diversion — where water comes from, where
        it's stored, and who is legally entitled to take it.
      </p>
    </details>

    <details>
      <summary>What inspired it?</summary>
      <p>
        It's a fresh take on the
        <a href="https://longnow.org/ideas/the-new-california-water-atlas/" target="_blank" rel="noopener">
          New California Water Atlas</a> (circa 2012–2014), led by Laci Videmsky at the Resource
        Renewal Institute, with Huey Johnson and Stewart Brand as advisors. That project itself
        revived a <em>printed</em> 1979 California water atlas as interactive maps — water rights,
        groundwater, and pricing — under a guiding idea: a "citizen atlas, where citizens' science
        sits alongside authoritative data."
      </p>
      <p>
        The original went offline; its maps and data quietly disappeared into link rot. That loss is
        the whole argument for this rebuild — see "Why rebuild it now?" below.
      </p>
    </details>

    <details>
      <summary>Why rebuild it now?</summary>
      <p>
        Two reasons. First, durability: the original vanished, so this version is deliberately small,
        open, and reproducible — a <code>git clone</code> and three commands recreate it from scratch,
        so it can't silently die the same way. Second, the data landscape is far better than in 2013:
        water rights are now a fast bulk download instead of a month-long scrape; satellites measure
        evapotranspiration field-by-field; modern open APIs replace brittle legacy ones; and
        MapLibre gives us a fully open-source map renderer. What took a funded team a year is now a
        weekend's work.
      </p>
    </details>

    <!-- ───────────────────────── WHY IT MATTERS ───────────────────────── -->
    <h2>Why it matters</h2>

    <details>
      <summary>What's the big idea — "paper water vs wet water"?</summary>
      <p>
        California has granted water rights totaling roughly <strong>370 million acre-feet</strong>
        per year — about <strong>five times</strong> the <strong>~70 million acre-feet</strong> its
        rivers actually carry in an average year
        (<a href="https://iopscience.iop.org/article/10.1088/1748-9326/9/8/084012" target="_blank" rel="noopener">Grantham &amp; Viers, 2014</a>).
        The original New California Water Atlas made the same point with its own numbers — ~250M
        acre-feet claimed against ~71M available. Either way the lesson holds: rights are a list;
        rights placed next to actual flow are a story.
      </p>
      <p>
        The atlas's job is to make that gap visible: where water comes from (snow, rain) → where
        it's stored (reservoirs) → who's allowed to take it (rights) → what's actually left for the
        river and the aquifer. (An acre-foot is roughly a football field flooded a foot deep.)
      </p>
    </details>

    <details>
      <summary>Why water, specifically?</summary>
      <p>
        Because water is intersectional — it touches almost everything we care about. Agriculture,
        cities, salmon and ecosystems, drinking-water safety, energy, climate adaptation, tribal
        rights, and the price on your utility bill are all the same water, allocated differently.
        A clear map of who gets what is civic infrastructure: it lets people see a system that
        usually only experts and lawyers can read.
      </p>
    </details>

    <!-- ───────────────────────── WHY A WEB APP ───────────────────────── -->
    <h2>Why a web app (and not just GIS)?</h2>

    <details>
      <summary>Why not just use QGIS / ArcGIS?</summary>
      <p>
        You absolutely could — for analysis, desktop GIS like QGIS or ArcGIS is more powerful than
        this will ever be. But those tools serve <em>analysts</em>: they require installing software,
        loading files, and knowing GIS. The audience here is <em>citizens</em> — a journalist, a
        farmer, a student, a curious neighbor — who should be able to open a link and understand
        something. A public URL anyone can open beats a project file a handful of specialists can load.
      </p>
    </details>

    <details>
      <summary>Then why not a hosted GIS product (ArcGIS Online, Felt, kepler.gl, Google Earth)?</summary>
      <p>
        Honest answer: those are good, and for a one-off you might just use them. We didn't, for the
        reason the original atlas teaches: <strong>durability</strong>. Hosted products are
        proprietary, account-walled, priced, and can change terms or shut down — exactly how the first
        atlas was lost. This site is plain static files driven by open data, hostable anywhere
        (including a plain web server), with no backend, no accounts, and no vendor. The bet is
        <em>small + open + rebuildable</em> over <em>feature-rich + dependent</em>. The tradeoff is
        real: we give up heavy interactive analysis to gain something that's hard to kill.
      </p>
    </details>

    <details>
      <summary>So why a web app at all?</summary>
      <p>
        Civic transparency and engagement. Putting public data behind a link — free, no login, works
        on a phone — is the lowest-friction way to let people see how a shared resource is governed.
        That's the point: not a tool for the few, but a window for the many.
      </p>
    </details>

    <!-- ───────────────────────── HOW IT'S BUILT ───────────────────────── -->
    <h2>How it's built</h2>

    <details>
      <summary>What's under the hood?</summary>
      <p>
        A small pipeline: public APIs → a local SQLite database → exported static GeoJSON → a
        Svelte + MapLibre map. The collector is polite (rate-limited, resumable, cached) and each
        data source is one small file, so adding a layer is a drop-in. The basemap is keyless
        OpenStreetMap data. Everything regenerates from public sources — the repo is the plumbing,
        not the data.
      </p>
    </details>

    <details>
      <summary>How did AI tools change what this took to build?</summary>
      <p>
        Honestly: a lot. The slow, expensive part of a project like this used to be the plumbing —
        spelunking undocumented agency APIs, figuring out pagination quirks, designing a schema,
        writing glue code, and drafting copy like this. Working with an AI assistant collapses much
        of that, which moves the scarce human effort to where it belongs: judgment, accuracy, and
        storytelling — deciding what's worth showing and how to be honest about it. It's not magic
        and it doesn't decide what matters; it lowers the labor of building so a tiny team can ship
        something a funded one used to.
      </p>
    </details>

    <!-- ───────────────────────── STAKEHOLDERS ───────────────────────── -->
    <h2>Who this is for</h2>

    <details>
      <summary>Who are the stakeholders?</summary>
      <p>
        Nearly everyone touched by California water: farmers and irrigation districts; cities and
        water utilities; tribes; environmental and fishery interests; regulators (the State Water
        Board, the Department of Water Resources); researchers and journalists; and the public who
        ultimately pays for and depends on the system. The data here is theirs — it's all public.
      </p>
    </details>

    <!-- ───────────────────────── USING IT ───────────────────────── -->
    <h2>Using the map</h2>

    <details>
      <summary>How do I use it?</summary>
      <p>
        Toggle layers in the panel at top-right. <strong>Reservoirs</strong> are colored by % full
        (red → green) and sized by storage. <strong>Gauges</strong> show recent streamflow.
        <strong>Water rights</strong> are points of diversion — where someone is entitled to take
        water. Click any point for details. Dense layers cluster when zoomed out; zoom in to split
        them apart.
      </p>
    </details>

    <details>
      <summary>How current is the data, and what are the caveats?</summary>
      <p>
        Live values come from the agencies' latest readings at the time the data was last collected;
        re-running the collector refreshes them. Caveats worth knowing: water-rights points show
        <em>where</em>, not yet <em>how much</em> or <em>who</em> (the face-value/owner join is a
        planned next step); not every gauge has a recent reading; and reservoir capacities are
        curated public figures. This is v1 — honest about its edges.
      </p>
    </details>

    <!-- ───────────────────────── DATA / REUSE ───────────────────────── -->
    <h2>Data &amp; reuse</h2>

    <details>
      <summary>Where does the data come from? Can I trust it?</summary>
      <p>
        From the agencies of record: <strong>USGS</strong> (stream gauges, US public domain),
        <strong>California DWR / CDEC</strong> (reservoirs), and the
        <strong>State Water Board / eWRIMS</strong> (water rights). It's all public data, fetched
        directly. The basemap is © OpenStreetMap contributors © CARTO. We add no numbers of our own —
        where we derive something (like % full), the inputs are shown.
      </p>
    </details>

    <details>
      <summary>Can I reuse or rebuild it?</summary>
      <p>
        Yes — that's the point. The data is public and the code is open. Anyone can clone it, run the
        collector and exporter, and stand up their own copy, or adapt the source modules to map
        something else entirely. It's designed to be forked, not gatekept.
      </p>
    </details>

    <!-- ───────────────────────── LINKS ───────────────────────── -->
    <h2>Links &amp; source</h2>

    <details>
      <summary>Where's the code, and what's it part of?</summary>
      <p>
        The full source — collector, exporter, and this site — lives at
        <a href="https://github.com/orbitalfoundation/water-atlas" target="_blank" rel="noopener">github.com/orbitalfoundation/water-atlas</a>.
        Clone it and a few commands rebuild the whole atlas from public data. It's part of
        <a href="https://open-cubed.exe.xyz/" target="_blank" rel="noopener">Open-Cubed</a>, an
        initiative for small, open, durable civic tools.
      </p>
      <p>
        It stands on the shoulders of the original
        <a href="https://github.com/NewCaliforniaWaterAtlas" target="_blank" rel="noopener">New California Water Atlas</a>,
        whose code and data — though the live site went dark — remain on GitHub. Their water-rights
        field dictionary and framing directly informed this rebuild.
      </p>
    </details>

    <button class="done" onclick={onClose}>Back to the map →</button>
    <p class="credit">
      Open data from USGS, California DWR (CDEC) &amp; the State Water Board (eWRIMS). ·
      <a href="https://github.com/orbitalfoundation/water-atlas" target="_blank" rel="noopener">Source</a> ·
      <a href="https://open-cubed.exe.xyz/" target="_blank" rel="noopener">Open-Cubed</a>
    </p>
  </div>
</div>
