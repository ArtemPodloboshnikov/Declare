<script lang="ts">
  import { t } from '$lib/i18n';
  import {
    presentation,
    type SlideElement,
    type TableSettings,
    DEFAULT_TABLE_SETTINGS
  } from '$lib/stores/presentation.svelte';
  import { TABLE_PRESETS, type TablePreset } from '$lib/services/table-presets';
  import { rgbToHex } from '$lib/services/common';
  import Checkbox from './Checkbox.svelte';
  import Slider from './Slider.svelte';
  import InputNumber from './InputNumber.svelte';
  import Table2 from '@lucide/svelte/icons/table-2';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import AlignLeft from '@lucide/svelte/icons/align-left';
  import AlignCenter from '@lucide/svelte/icons/align-center';
  import AlignRight from '@lucide/svelte/icons/align-right';

  let { element }: { element: SlideElement } = $props();

  const settings = $derived({
    ...DEFAULT_TABLE_SETTINGS,
    ...(element.table ?? {})
  });

  // ---------- Локальные буферы для цветов ----------
  let headerBgInput = $state('#262633');
  let headerColorInput = $state('#e8e8f0');
  let cellColorInput = $state('#e8e8f0');
  let borderColorInput = $state('#2a2a38');
  let stripeColorInput = $state('rgba(255, 255, 255, 0.02)');

  // Синхронизация при смене элемента или изменении settings
  let lastElementId = $state<string | null>(null);
  $effect(() => {
    if (element.id !== lastElementId) {
      lastElementId = element.id;
    }
    headerBgInput = toHex(settings.headerBg);
    headerColorInput = toHex(settings.headerColor);
    cellColorInput = toHex(settings.cellColor);
    borderColorInput = toHex(settings.borderColor);
    stripeColorInput = settings.stripeColor;
  });

  // ---------- Локальный буфер для толщины границ ----------
  let borderWidthInput = $state(1);
  $effect(() => {
    borderWidthInput = settings.borderWidth;
  });

  function toHex(v: string | undefined): string {
    if (!v) return '#000000';
    if (v.startsWith('#')) {
      // 8-значный hex → 6-значный
      if (v.length === 9) return v.slice(0, 7);
      return v;
    }
    return rgbToHex(v) ?? "#000000";
  }

  function update(patch: Partial<TableSettings>) {
    presentation.updateElement(element.id, {
      table: { ...settings, ...patch }
    }, true);
  }

  function commit() {
    presentation.commitPendingHistory();
  }

  function reset() {
    presentation.updateElement(element.id, { table: undefined });
    commit();
  }

  function applyPreset(preset: TablePreset) {
    presentation.updateElement(element.id, {
      table: { ...preset.settings }
    });
    commit();
  }

  function isPresetActive(preset: TablePreset): boolean {
    const s = settings;
    const p = preset.settings;
    return (
      s.headerBg === p.headerBg &&
      s.headerColor === p.headerColor &&
      s.cellColor === p.cellColor &&
      s.borderColor === p.borderColor &&
      s.borderWidth === p.borderWidth &&
      s.striped === p.striped &&
      s.stripeColor === p.stripeColor &&
      s.fontSize === p.fontSize &&
      s.textAlign === p.textAlign &&
      s.paddingX === p.paddingX &&
      s.paddingY === p.paddingY &&
      s.showHeader === p.showHeader
    );
  }
</script>

<div class="table-panel">
  <header class="panel-subheader">
    <Table2 size={14} strokeWidth={1.75} />
    <span>{t('table.panelTitle')}</span>
  </header>
  <!-- Пресеты -->
  <div class="block">
    <span class="panel-lbl">{t('table.presets')}</span>
    <div class="preset-grid">
      {#each TABLE_PRESETS as preset (preset.id)}
        <button
          type="button"
          class="preset-btn"
          class:active={isPresetActive(preset)}
          onclick={() => applyPreset(preset)}
          title={t(preset.labelKey)}
        >
          <span
            class="preset-preview"
            style="
              --p-header-bg: {preset.preview.headerBg};
              --p-header-color: {preset.preview.headerColor};
              --p-cell-color: {preset.preview.cellColor};
              --p-border: {preset.preview.borderColor};
              --p-stripe: {preset.preview.stripeColor ?? 'transparent'};
            "
          >
            <span class="p-row p-head"></span>
            <span class="p-row {preset.preview.striped ? 'p-stripe' : ''}"></span>
            <span class="p-row"></span>
          </span>
          <span class="preset-label">{t(preset.labelKey)}</span>
        </button>
      {/each}
    </div>
  </div>
  <!-- Заголовок -->
  <div class="block">
    <Checkbox
      checked={settings.showHeader}
      label={t('table.showHeader')}
      onchange={(v) => { update({ showHeader: v }); commit(); }}
    />
    {#if settings.showHeader}
      <div class="row">
        <span class="panel-lbl">{t('table.headerBg')}</span>
        <div class="color-control">
          <input
            type="color"
            value={headerBgInput}
            oninput={(e) => { headerBgInput = e.currentTarget.value; update({ headerBg: headerBgInput }); }}
            onchange={commit}
          />
          <input
            type="text"
            class="color-text"
            value={headerBgInput}
            oninput={(e) => { headerBgInput = e.currentTarget.value; update({ headerBg: headerBgInput }); }}
            onchange={commit}
          />
        </div>
      </div>
      <div class="row">
        <span class="panel-lbl">{t('table.headerColor')}</span>
        <div class="color-control">
          <input
            type="color"
            value={headerColorInput}
            oninput={(e) => { headerColorInput = e.currentTarget.value; update({ headerColor: headerColorInput }); }}
            onchange={commit}
          />
          <input
            type="text"
            class="color-text"
            value={headerColorInput}
            oninput={(e) => { headerColorInput = e.currentTarget.value; update({ headerColor: headerColorInput }); }}
            onchange={commit}
          />
        </div>
      </div>
    {/if}
  </div>

  <!-- Цвета -->
  <div class="block">
    <div class="row">
      <span class="panel-lbl">{t('table.cellColor')}</span>
      <div class="color-control">
        <input
          type="color"
          value={cellColorInput}
          oninput={(e) => { cellColorInput = e.currentTarget.value; update({ cellColor: cellColorInput }); }}
          onchange={commit}
        />
        <input
          type="text"
          class="color-text"
          value={cellColorInput}
          oninput={(e) => { cellColorInput = e.currentTarget.value; update({ cellColor: cellColorInput }); }}
          onchange={commit}
        />
      </div>
    </div>
    <div class="row">
      <span class="panel-lbl">{t('table.borderColor')}</span>
      <div class="color-control">
        <input
          type="color"
          value={borderColorInput}
          oninput={(e) => { borderColorInput = e.currentTarget.value; update({ borderColor: borderColorInput }); }}
          onchange={commit}
        />
        <input
          type="text"
          class="color-text"
          value={borderColorInput}
          oninput={(e) => { borderColorInput = e.currentTarget.value; update({ borderColor: borderColorInput }); }}
          onchange={commit}
        />
      </div>
    </div>
    <div class="row">
      <span class="panel-lbl">{t('table.borderWidth')}</span>
      <Slider
        value={borderWidthInput}
        min={0} max={6} step={0.5}
        suffix="px"
        oninput={(v) => { borderWidthInput = v; update({ borderWidth: v }); }}
        onchange={commit}
      />
    </div>
  </div>

  <!-- Чередование -->
  <div class="block">
    <Checkbox
      checked={settings.striped}
      label={t('table.striped')}
      onchange={(v) => { update({ striped: v }); commit(); }}
    />
    {#if settings.striped}
      <div class="row">
        <span class="panel-lbl">{t('table.stripeColor')}</span>
        <div class="color-control">
          <input
            type="color"
            value={stripeColorInput.startsWith('#') ? stripeColorInput.slice(0, 7) : '#ffffff'}
            oninput={(e) => { stripeColorInput = e.currentTarget.value; update({ stripeColor: stripeColorInput }); }}
            onchange={commit}
          />
          <input
            type="text"
            class="color-text"
            value={stripeColorInput}
            oninput={(e) => { stripeColorInput = e.currentTarget.value; update({ stripeColor: stripeColorInput }); }}
            onchange={commit}
          />
        </div>
      </div>
    {/if}
  </div>

  <!-- Типографика -->
  <div class="block">
    <div class="row">
      <span class="panel-lbl">{t('table.fontSize')}</span>
      <InputNumber
        value={settings.fontSize}
        min={8} max={48} step={1}
        suffix="px"
        onchange={(v) => { update({ fontSize: v }); commit(); }}
      />
    </div>

    <div class="row">
      <div class="panel-lbl">{t('table.textAlign')}</div>
      <div class="align-group">
        {#each [
          { v: 'left',   Icon: AlignLeft,   title: 'text.alignLeft' },
          { v: 'center', Icon: AlignCenter, title: 'text.alignCenter' },
          { v: 'right',  Icon: AlignRight,  title: 'text.alignRight' }
        ] as opt (opt.v)}
          <button
            type="button"
            class:active={settings.textAlign === opt.v}
            onclick={() => { update({ textAlign: opt.v as TableSettings['textAlign'] }); commit(); }}
            title={t(opt.title)}
            aria-label={t(opt.title)}
          >
            <opt.Icon size={15} strokeWidth={1.75} />
          </button>
        {/each}
      </div>
    </div>

    <div class="row">
      <span class="panel-lbl">{t('table.paddingX')}</span>
      <InputNumber
        value={settings.paddingX}
        min={0} max={40} step={1}
        suffix="px"
        onchange={(v) => { update({ paddingX: v }); commit(); }}
      />
    </div>
    <div class="row">
      <span class="panel-lbl">{t('table.paddingY')}</span>
      <InputNumber
        value={settings.paddingY}
        min={0} max={40} step={1}
        suffix="px"
        onchange={(v) => { update({ paddingY: v }); commit(); }}
      />
    </div>
  </div>

  <div class="actions">
    <button class="ghost" onclick={reset}>
      <RotateCcw size={14} strokeWidth={1.75} />
      {t('common.reset')}
    </button>
  </div>
</div>

<style>
  .table-panel {
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
  .row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* ---------- Цвет ---------- */
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

  /* ---------- Выравнивание ---------- */
  .align-group {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }
  .align-group button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    height: 34px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
  }
  .align-group button:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
    color: var(--text-primary);
  }
  .align-group button.active {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: #fff;
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

  /* ---------- Пресеты ---------- */
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .preset-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--text-secondary);
    transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
  }
  .preset-btn:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
    color: var(--text-primary);
  }
  .preset-btn.active {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 2px var(--accent-dim);
    color: var(--text-primary);
  }

  .preset-preview {
    width: 100%;
    height: 36px;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--p-border);
    background: var(--bg-primary);
  }

  .p-row {
    flex: 1;
    min-height: 0;
  }
  .p-row.p-head {
    background: var(--p-header-bg);
    border-bottom: 1px solid var(--p-border);
  }
  .p-row.p-stripe {
    background: var(--p-stripe);
  }
  .p-row:not(.p-head) {
    border-bottom: 1px solid var(--p-border);
  }
  .p-row:last-child {
    border-bottom: none;
  }

  .preset-label {
    font-size: 10px;
    line-height: 1.1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
