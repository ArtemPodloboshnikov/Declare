<script lang="ts">
  import { t } from '$lib/i18n';
  import {
    presentation,
    type SlideElement,
    type ChartSettings,
    DEFAULT_CHART_SETTINGS
  } from '$lib/stores/presentation.svelte';
  import { ensureColors, colorFor } from '$lib/services/chart-colors';
  import Checkbox from './Checkbox.svelte';
  import InputNumber from './InputNumber.svelte';
  import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import { isCircular } from '$lib/services/common';

  let { element }: { element: SlideElement } = $props();

  // ---------- Данные ----------
  interface ChartData {
    kind: 'bar' | 'line' | 'pie' | 'doughnut';
    labels: string[];
    values: number[];
    datasetLabel: string;
    colors?: string[];
  }

  const data = $derived.by<ChartData>(() => {
    try {
      const parsed = JSON.parse(element.content || '{}');
      return {
        kind: parsed.kind ?? 'bar',
        labels: parsed.labels ?? [],
        values: parsed.values ?? [],
        datasetLabel: parsed.datasetLabel ?? '',
        colors: ensureColors(parsed.labels?.length ?? 0, parsed.colors)
      };
    } catch {
      return { kind: 'bar', labels: [], values: [], datasetLabel: '', colors: [] };
    }
  });

  function updateData(patch: Partial<ChartData>) {
    const next: ChartData = { ...data, ...patch };
    presentation.updateElement(element.id, { content: JSON.stringify(next) }, true);
  }

  function commit() {
    presentation.commitPendingHistory();
  }

  function onColorChange(index: number, color: string) {
    const colors = [...(data.colors ?? [])];
    colors[index] = color;
    updateData({ colors });
  }

  function onLabelChange(index: number, value: string) {
    const labels = [...data.labels];
    labels[index] = value;
    updateData({ labels });
  }

  function onValueChange(index: number, value: number) {
    const values = [...data.values];
    values[index] = value;
    updateData({ values });
  }

  function addRow() {
    const labels = [...data.labels, `Item ${data.labels.length + 1}`];
    const values = [...data.values, 0];
    const colors = ensureColors(labels.length, data.colors);
    updateData({ labels, values, colors });
    commit();
  }

  function removeRow(index: number) {
    const labels = data.labels.filter((_, i) => i !== index);
    const values = data.values.filter((_, i) => i !== index);
    const colors = (data.colors ?? []).filter((_, i) => i !== index);
    updateData({ labels, values, colors });
    commit();
  }

  function resetColors() {
    const colors = data.labels.map((_, i) => colorFor(i));
    updateData({ colors });
    commit();
  }

  // ---------- Вид ----------
  const settings = $derived<ChartSettings>({
    ...DEFAULT_CHART_SETTINGS,
    ...(element.chart ?? {})
  });

  let datasetLabelColorInput = $state('#e8e8f0');
  let legendColorInput = $state('#e8e8f0');
  let axisLabelColorInput = $state('#a0a0b8');
  let gridColorInput = $state('#ffffff10');

  $effect(() => {
    datasetLabelColorInput = toHex(settings.datasetLabelColor);
    legendColorInput = toHex(settings.legendColor);
    axisLabelColorInput = toHex(settings.axisLabelColor);
    gridColorInput = toHex(settings.gridColor);
  });

  function toHex(v: string): string {
    if (!v) return '#000000';
    if (v.startsWith('#')) return v.length === 9 ? v.slice(0, 7) : v;
    const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
      const [_, r, g, b] = m;
      return '#' + [r, g, b].map(x => (+x).toString(16).padStart(2, '0')).join('');
    }
    return '#000000';
  }

  function update(patch: Partial<ChartSettings>) {
    presentation.updateElement(element.id, {
      chart: { ...settings, ...patch }
    }, true);
  }

  function resetAll() {
    presentation.updateElement(element.id, { chart: undefined });
    commit();
  }
</script>

<div class="chart-panel">
  <header class="panel-subheader">
    <BarChart3 size={14} strokeWidth={1.75} />
    <span>{t('chart.panelTitle')}</span>
  </header>

  <!-- ==================== ДАННЫЕ ==================== -->
  <div class="block">
    <div class="block-title">{t('chart.dataSection')}</div>

    <div class="colors-list">
      {#each data.labels as label, i (i)}
        <div class="color-row">
          <input
            type="color"
            class="color-input"
            value={data.colors?.[i] ?? colorFor(i)}
            oninput={(e) => onColorChange(i, (e.currentTarget as HTMLInputElement).value)}
            onchange={commit}
            aria-label={t('chart.colorFor', { label })}
          />
          <input
            type="text"
            class="label-input"
            value={label}
            oninput={(e) => onLabelChange(i, (e.currentTarget as HTMLInputElement).value)}
            onblur={commit}
            aria-label={t('chart.label')}
          />
          <input
            type="number"
            class="value-input"
            value={data.values[i] ?? 0}
            oninput={(e) => onValueChange(i, Number((e.currentTarget as HTMLInputElement).value) || 0)}
            onblur={commit}
            aria-label={t('chart.value')}
          />
          <button
            type="button"
            class="icon-btn"
            onclick={() => removeRow(i)}
            disabled={data.labels.length <= 1}
            aria-label={t('chart.removeRow')}
          >
            <Trash2 size={12} strokeWidth={1.75} />
          </button>
        </div>
      {/each}
    </div>

    <div class="panel-actions">
      <button type="button" class="ghost small" onclick={addRow}>
        <Plus size={12} strokeWidth={1.75} />
        {t('chart.addRow')}
      </button>
      <button type="button" class="ghost small" onclick={resetColors}>
        {t('chart.resetColors')}
      </button>
    </div>

    <div class="row">
      <span class="panel-lbl">{t('chart.dataset')}</span>
      <input
        type="text"
        value={data.datasetLabel}
        oninput={(e) => updateData({ datasetLabel: (e.currentTarget as HTMLInputElement).value })}
        onblur={commit}
      />
    </div>
  </div>

  <!-- ==================== ВИД ==================== -->
  <div class="block">
    <div class="block-title">{t('chart.appearanceSection')}</div>

    <!-- Название серии -->
    {#if !isCircular(data.kind)}
    <Checkbox
      checked={settings.showDatasetLabel}
      label={t('chart.showDatasetLabel')}
      onchange={(v) => { update({ showDatasetLabel: v }); commit(); }}
    />
    {#if settings.showDatasetLabel}
      <div class="row">
        <span class="panel-lbl">{t('chart.datasetLabelColor')}</span>
        <div class="color-control">
          <input
            type="color"
            value={datasetLabelColorInput}
            oninput={(e) => { datasetLabelColorInput = e.currentTarget.value; update({ datasetLabelColor: datasetLabelColorInput }); }}
            onchange={commit}
          />
          <input
            type="text"
            class="color-text"
            value={datasetLabelColorInput}
            oninput={(e) => { datasetLabelColorInput = e.currentTarget.value; update({ datasetLabelColor: datasetLabelColorInput }); }}
            onchange={commit}
          />
        </div>
      </div>
      <div class="row">
        <span class="panel-lbl">{t('chart.datasetLabelSize')}</span>
        <InputNumber
          value={settings.datasetLabelSize}
          min={8} max={48} step={1}
          suffix="px"
          onchange={(v) => { update({ datasetLabelSize: v }); commit(); }}
        />
      </div>
    {/if}
    {/if}

  <!-- Легенда -->
  {#if isCircular(data.kind)}
    <Checkbox
    checked={settings.showLegend}
    label={t('chart.showLegend')}
    onchange={(v) => { update({ showLegend: v }); commit(); }}
    />
    {#if settings.showLegend}
    <div class="row">
        <span class="panel-lbl">{t('chart.legendColor')}</span>
        <div class="color-control">
        <input
            type="color"
            value={legendColorInput}
            oninput={(e) => { legendColorInput = e.currentTarget.value; update({ legendColor: legendColorInput }); }}
            onchange={commit}
        />
        <input
            type="text"
            class="color-text"
            value={legendColorInput}
            oninput={(e) => { legendColorInput = e.currentTarget.value; update({ legendColor: legendColorInput }); }}
            onchange={commit}
        />
        </div>
    </div>
    <div class="row">
        <span class="panel-lbl">{t('chart.legendSize')}</span>
        <InputNumber
        value={settings.legendSize}
        min={8} max={32} step={1}
        suffix="px"
        onchange={(v) => { update({ legendSize: v }); commit(); }}
        />
    </div>
    {/if}
  {/if}
  </div>


  <!-- Оси -->
  <div class="block">
    <div class="row">
      <span class="panel-lbl">{t('chart.axisLabelColor')}</span>
      <div class="color-control">
        <input
          type="color"
          value={axisLabelColorInput}
          oninput={(e) => { axisLabelColorInput = e.currentTarget.value; update({ axisLabelColor: axisLabelColorInput }); }}
          onchange={commit}
        />
        <input
          type="text"
          class="color-text"
          value={axisLabelColorInput}
          oninput={(e) => { axisLabelColorInput = e.currentTarget.value; update({ axisLabelColor: axisLabelColorInput }); }}
          onchange={commit}
        />
      </div>
    </div>
    <div class="row">
      <span class="panel-lbl">{t('chart.axisLabelSize')}</span>
      <InputNumber
        value={settings.axisLabelSize}
        min={8} max={32} step={1}
        suffix="px"
        onchange={(v) => { update({ axisLabelSize: v }); commit(); }}
      />
    </div>
    <div class="row">
      <span class="panel-lbl">{t('chart.gridColor')}</span>
      <div class="color-control">
        <input
          type="color"
          value={gridColorInput}
          oninput={(e) => { gridColorInput = e.currentTarget.value; update({ gridColor: gridColorInput }); }}
          onchange={commit}
        />
        <input
          type="text"
          class="color-text"
          value={gridColorInput}
          oninput={(e) => { gridColorInput = e.currentTarget.value; update({ gridColor: gridColorInput }); }}
          onchange={commit}
        />
      </div>
    </div>
  </div>

  <div class="actions">
    <button class="ghost" onclick={resetAll}>
      <RotateCcw size={14} strokeWidth={1.75} />
      {t('common.reset')}
    </button>
  </div>
</div>

<style>
  .chart-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-top: 1px solid var(--border-subtle);
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
  }
  .block-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    margin-bottom: 2px;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* ---------- Данные ---------- */
  .colors-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 260px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .color-row {
    display: grid;
    grid-template-columns: 28px 1fr 60px 24px;
    gap: 4px;
    align-items: center;
  }
  .color-input {
    width: 28px;
    height: 28px;
    padding: 1px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    cursor: pointer;
  }
  .label-input,
  .value-input {
    height: 28px;
    padding: 4px 6px;
    font-size: 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    outline: none;
  }
  .value-input {
    text-align: right;
    font-variant-numeric: tabular-nums;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .value-input::-webkit-outer-spin-button,
  .value-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .label-input:focus,
  .value-input:focus {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 2px var(--accent-dim);
  }
  .icon-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
  }
  .icon-btn:hover:not(:disabled) {
    color: var(--danger);
    border-color: var(--danger);
  }
  .icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* ---------- Вид ---------- */
  .color-control {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 6px;
  }
  .color-control input[type="color"] {
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

  /* ---------- Общие ---------- */
  .panel-actions {
    display: flex;
    gap: 6px;
  }
  .small {
    font-size: 11px;
    padding: 4px 8px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  .actions button {
    flex: 1;
    justify-content: center;
    font-size: 12px;
  }
</style>
