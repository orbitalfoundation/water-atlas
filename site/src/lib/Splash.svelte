<script>
  let { layers = [], onClose, onFaq } = $props();
  const rights = $derived(layers.find((l) => l.layer === 'waterrights')?.count ?? 0);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="splash-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onClose()}>
  <div class="splash">
    <h1>The Water Atlas</h1>
    <p class="lede">
      California's water, made legible — built entirely from open public data, and rebuildable by
      anyone, forever.
    </p>

    <p>
      Water is the most contested resource in the West, yet the data that governs it is scattered
      across a dozen agencies and buried in slow databases. This atlas pulls it into one place:
      where the water comes from, where it's stored, and who is legally entitled to take it.
    </p>

    <div class="stats">
      <div><strong>{rights.toLocaleString()}</strong><span>points of diversion mapped</span></div>
      <div><strong>~5×</strong><span>more water rights on paper than the rivers actually carry</span></div>
      <div><strong>100%</strong><span>open, reproducible data</span></div>
    </div>

    <p class="why">
      A decade ago, the
      <a href="https://longnow.org/ideas/the-new-california-water-atlas/" target="_blank" rel="noopener">
        New California Water Atlas</a>
      imagined "a citizen atlas, where citizens' science sits alongside authoritative data." It went
      offline. This is a fresh take on that idea — small, open, and durable, so it can't quietly
      disappear again.
    </p>

    <button onclick={onClose}>Explore the map →</button>
    <p class="credit">
      Open data from USGS, California DWR (CDEC) &amp; the State Water Board (eWRIMS). ·
      <!-- svelte-ignore a11y_invalid_attribute -->
      <a href="#faq" onclick={(e) => { e.preventDefault(); onFaq?.(); }}>Read the FAQ</a>
    </p>
  </div>
</div>
