<script>
  let { layers = [], loading = false, onToggle, onAbout, onFaq } = $props();
</script>

<aside class="panel">
  <header>
    <h1>Water Atlas</h1>
    <p class="sub">California · live water data</p>
  </header>

  {#if loading}
    <p class="loading">Loading layers…</p>
  {/if}

  <ul class="layers">
    {#each layers as layer (layer.layer)}
      <li>
        <label>
          <input type="checkbox" checked={layer.visible} onchange={() => onToggle(layer)} />
          <span class="swatch" style:background={layer.color}></span>
          <span class="title">{layer.title}</span>
        </label>
        <span class="count">{layer.count.toLocaleString()}</span>
      </li>
    {/each}
  </ul>

  <p class="legend">
    Reservoirs are colored by <strong>% full</strong> (red → green) and sized by storage.
    The <strong>drought</strong> wash runs yellow (dry) → dark red (exceptional).
    <strong>Oregon</strong> &amp; <strong>Nevada</strong> water rights are off by default — toggle
    them on and they load on demand. Click any point or area for details.
  </p>

  <div class="actions">
    <button class="about" onclick={onAbout}>About</button>
    <button class="about" onclick={onFaq}>FAQ</button>
  </div>
  <footer>
    Public APIs: USGS · CDEC · eWRIMS<br />
    <a href="https://github.com/orbitalfoundation/water-atlas" target="_blank" rel="noopener">Source</a> ·
    <a href="https://open-cubed.exe.xyz/" target="_blank" rel="noopener">Open-Cubed</a>
  </footer>
</aside>
