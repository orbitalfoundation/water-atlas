<script>
  import { onMount } from 'svelte';
  import { createMap, addLayerFromManifest, setLayerVisibility, KIND_ORDER } from './lib/map.js';
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

  onMount(async () => {
    const manifest = await fetch('data/layers.json').then((r) => r.json()).catch(() => []);
    manifest.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    layers = manifest.map((m) => ({ ...m, visible: true }));

    map = createMap(mapEl);
    map.on('load', () => {
      for (const entry of layers) addLayerFromManifest(map, entry);
      loading = false;
    });
  });

  function toggle(layer) {
    layer.visible = !layer.visible;
    setLayerVisibility(map, layer, layer.visible);
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
