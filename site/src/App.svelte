<script>
  import { onMount } from 'svelte';
  import { createMap, addLayerFromManifest, setLayerVisibility, KIND_ORDER, MAP_ORDER } from './lib/map.js';
  import Splash from './lib/Splash.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import Faq from './lib/Faq.svelte';

  let mapEl;
  let map;
  let layers = $state([]);
  let showSplash = $state(true);
  let showFaq = $state(false);
  let loading = $state(true);

  function openFaq() {
    showSplash = false;
    showFaq = true;
  }

  // Layers already attached to the map. Heavy out-of-state layers (manifest `hidden`) are not
  // fetched until first toggled on, so the initial load stays light.
  const added = new Set();

  onMount(async () => {
    const manifest = await fetch('data/layers.json').then((r) => r.json()).catch(() => []);
    manifest.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    layers = manifest.map((m) => ({ ...m, visible: !m.hidden }));

    map = createMap(mapEl);
    map.on('load', () => {
      // Attach in draw order (bottom -> top), independent of the sidebar's display order.
      const drawOrder = [...layers].sort((a, b) => MAP_ORDER.indexOf(a.kind) - MAP_ORDER.indexOf(b.kind));
      for (const entry of drawOrder) if (entry.visible) {
        addLayerFromManifest(map, entry);
        added.add(entry.layer);
      }
      loading = false;
    });
  });

  function toggle(layer) {
    layer.visible = !layer.visible;
    if (layer.visible && !added.has(layer.layer)) {
      addLayerFromManifest(map, layer); // lazy first attach (downloads its GeoJSON now)
      added.add(layer.layer);
    } else {
      setLayerVisibility(map, layer, layer.visible);
    }
  }
</script>

<div class="app">
  <div class="map" bind:this={mapEl}></div>
  <Sidebar {layers} {loading} onToggle={toggle} onAbout={() => (showSplash = true)} onFaq={openFaq} />
  {#if showSplash}
    <Splash {layers} onClose={() => (showSplash = false)} onFaq={openFaq} />
  {/if}
  {#if showFaq}
    <Faq {layers} onClose={() => (showFaq = false)} />
  {/if}
</div>
