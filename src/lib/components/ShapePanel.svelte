<script lang="ts">
  import { t } from '$lib/i18n';
  import { presentation, type SlideElement } from '$lib/stores/presentation.svelte';

  let { element }: { element: SlideElement } = $props();

  const isOutline = $derived(element.shape?.kind === 'line');
  const fill = $derived(element.style?.fill ?? '#7c6cf0');

  // Палитра быстрых цветов
  const SWATCHES = [
    '#7c6cf0', '#60a5fa', '#4ade80', '#fbbf24',
    '#f87171', '#f472b6', '#a78bfa', '#94a3b8',
    '#e8e8f0', '#0f0f14', '#1e1e28', 'transparent'
  ];

  function updateStyle(patch: Record<string, unknown>) {
    presentation.updateElement(element.id, {
      style: { ...(element.style ?? {}), ...patch }
    }, true); // debounce — не писать каждый чих в историю
  }

  function commitStyle() {
    presentation.commitPendingHistory();
  }
</script>

<div class="shape-style-panel">
  {#if !isOutline}
    <div class="row">
      <label class="panel-lbl">{t('shape.fill')}</label>
      <div class="color-row">
        <input
          type="color"
          class="color-input"
          value={fill === 'transparent' ? '#000000' : fill}
          oninput={(e) => updateStyle({ fill: (e.currentTarget as HTMLInputElement).value })}
          onblur={commitStyle}
        />
        <input
          type="text"
          class="color-text"
          value={fill}
          oninput={(e) => updateStyle({ fill: (e.currentTarget as HTMLInputElement).value })}
          onblur={commitStyle}
        />
      </div>
    </div>

    <div class="row">
      <label class="panel-lbl">{t('shape.swatches')}</label>
      <div class="swatches">
        {#each SWATCHES as sw (sw)}
          <button
            type="button"
            class="swatch"
            class:active={fill === sw}
            style="background: {sw === 'transparent' ? 'transparent' : sw};"
            onclick={() => { updateStyle({ fill: sw }); commitStyle(); }}
            aria-label={sw}
          ></button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .shape-style-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-top: 1px solid var(--border-subtle);
  }
  .row { display: flex; flex-direction: column; gap: 6px; }
  .color-row { display: grid; grid-template-columns: 40px 1fr; gap: 6px; }
  .color-input {
    width: 40px;
    height: 34px;
    padding: 2px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    cursor: pointer;
  }
  .color-text {
    height: 34px;
    padding: 7px 10px;
    font-family: var(--font-mono);
    font-size: 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-primary);
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
  }
  .swatch {
    aspect-ratio: 1;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    padding: 0;
  }
  .swatch.active {
    outline: 2px solid var(--accent-primary);
    outline-offset: 1px;
  }
  .swatch[style*="transparent"] {
    background-image:
      linear-gradient(45deg, #444 25%, transparent 25%),
      linear-gradient(-45deg, #444 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #444 75%),
      linear-gradient(-45deg, transparent 75%, #444 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
  }
</style>
