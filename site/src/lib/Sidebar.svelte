<script>
  let { layers = [], loading = false, onToggle, onAbout, onFaq } = $props();

  const DROUGHT_LEVELS = [
    { color: '#ffff00', code: 'D0', label: 'Dry' },
    { color: '#fcd37f', code: 'D1', label: 'Moderate' },
    { color: '#ffaa00', code: 'D2', label: 'Severe' },
    { color: '#e60000', code: 'D3', label: 'Extreme' },
    { color: '#730000', code: 'D4', label: 'Exceptional' },
  ];

  const RESERVOIR_GRADIENT = {
    gradient: 'linear-gradient(90deg, #d73027 0%, #fc8d59 30%, #fee08b 50%, #91cf60 75%, #1a9850 100%)',
    left: 'Empty', right: 'Full',
  };
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
    {#each layers as layer, i (layer.layer)}
      {@const group = layer.kind === 'gauge' || layer.kind === 'reservoir' ? 'wet' : layer.kind === 'right' ? 'paper' : 'conditions'}
      {@const prevGroup = i > 0 ? (layers[i-1].kind === 'gauge' || layers[i-1].kind === 'reservoir' ? 'wet' : layers[i-1].kind === 'right' ? 'paper' : 'conditions') : ''}
      {#if group !== prevGroup}
        <li class="layer-group">{group === 'wet' ? 'Wet water' : group === 'paper' ? 'Paper water' : 'Conditions'}</li>
      {/if}
      <li>
        <label>
          <input type="checkbox" checked={layer.visible} onchange={() => onToggle(layer)} />
          {#if layer.layer !== 'drought' && layer.layer !== 'reservoirs'}
            <span class="swatch" style:background={layer.color}></span>
          {/if}
          <span class="title">{layer.title}</span>
        </label>
        <span class="count">{layer.count.toLocaleString()}</span>
        {#if layer.layer === 'drought'}
          <div class="scale-bar">
            <div class="drought-blocks">
              {#each DROUGHT_LEVELS as level}
                <span class="drought-block" style="background: {level.color};"></span>
              {/each}
            </div>
          </div>
        {:else if layer.layer === 'reservoirs'}
          <div class="scale-bar">
            <span class="scale-label">Empty</span>
            <span class="gradient-track" style="background: {RESERVOIR_GRADIENT.gradient};"></span>
            <span class="scale-label">Full</span>
          </div>
        {/if}
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
