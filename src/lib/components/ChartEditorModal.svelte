<script lang="ts">
  import { t } from '$lib/i18n';
  import { pickFile, readTextFile, readXlsx, parseCsv } from '$lib/services/file-import';
  import Select from './Select.svelte';
  import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
  import X from '@lucide/svelte/icons/x';
  import Upload from '@lucide/svelte/icons/upload';

  type ChartKind = 'bar' | 'line' | 'pie' | 'doughnut';

  let {
    onClose,
    onSubmit
  }: {
    onClose: () => void;
    onSubmit: (data: {
      kind: ChartKind;
      labels: string[];
      values: number[];
      datasetLabel: string;
    }) => void;
  } = $props();

  let kind = $state<ChartKind>('bar');
  let datasetLabel = $state('Series 1');
  let labelsText = $state('Январь\nФевраль\nМарт\nАпрель');
  let valuesText = $state('10\n25\n18\n32');
  let importError = $state<string | null>(null);

  let labels = $derived(labelsText.split('\n').map(s => s.trim()));
  let values = $derived(
    valuesText.split('\n').map(s => Number(s.trim())).map(v => (isNaN(v) ? 0 : v))
  );

  let mismatch = $derived(labels.length !== values.length);

  async function importFile() {
    importError = null;
    const picked = await pickFile('.csv,.xlsx,.xls,text/csv');
    if (!picked) return;
    try {
      let parsed: string[][];
      if (picked.name.toLowerCase().endsWith('.csv')) {
        const text = await readTextFile(picked.file);
        parsed = parseCsv(text);
      } else {
        parsed = await readXlsx(picked.file);
      }
      if (!parsed.length) {
        importError = t('table.emptyFile');
        return;
      }
      const ls: string[] = [];
      const vs: number[] = [];
      for (const row of parsed) {
        if (!row.length) continue;
        ls.push(String(row[0] ?? '').trim());
        vs.push(Number(String(row[1] ?? '0').replace(',', '.')) || 0);
      }
      labelsText = ls.join('\n');
      valuesText = vs.join('\n');
    } catch (e) {
      importError = `${t('table.importFailed')}: ${e instanceof Error ? e.message : e}`;
    }
  }

  function submit() {
    if (mismatch) return;
    onSubmit({ kind, labels, values, datasetLabel });
  }
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation">
  <div class="modal chart-modal" onclick={(e) => e.stopPropagation()} role="presentation">
    <header class="modal-header">
      <h3>
        <BarChart3 size={16} strokeWidth={1.75} />
        {t('chart.title')}
      </h3>
      <button class="ghost" onclick={onClose} aria-label={t('common.close')}>
        <X size={16} strokeWidth={1.75} />
      </button>
    </header>

    <div class="modal-body">
      <div class="row">
        <label>
          <span class="panel-lbl">{t('chart.kind')}</span>
          <Select
            bind:value={kind}
            options={[
              { value: 'bar', label: t('chart.bar') },
              { value: 'line', label: t('chart.line') },
              { value: 'pie', label: t('chart.pie') },
              { value: 'doughnut', label: t('chart.doughnut') }
            ]}
          />
        </label>
        <label>
          <span class="panel-lbl">{t('chart.dataset')}</span>
          <input type="text" bind:value={datasetLabel} />
        </label>
      </div>

      {#if importError}
        <div class="err">{importError}</div>
      {/if}

      <div class="cols">
        <label class="col">
          <span class="panel-lbl">{t('chart.labels')}</span>
          <textarea rows="8" bind:value={labelsText}></textarea>
        </label>
        <label class="col">
          <span class="panel-lbl">{t('chart.values')}</span>
          <textarea rows="8" bind:value={valuesText}></textarea>
        </label>
      </div>

      {#if mismatch}
        <div class="err">{t('chart.mismatch')}</div>
      {/if}

      <button class="import-btn" onclick={importFile}>
        <Upload size={14} strokeWidth={1.75} />
        {t('chart.importCsv')}
      </button>
    </div>

    <footer class="modal-footer">
      <button class="ghost" onclick={onClose}>{t('common.cancel')}</button>
      <button class="primary" onclick={submit} disabled={mismatch}>
        {t('common.insert')}
      </button>
    </footer>
  </div>
</div>

<style>
  .chart-modal { width: min(90vw, 620px); }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid var(--border-subtle);
  }
  .modal-header h3 {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
  }
  .modal-header h3 :global(svg) {
    color: var(--accent-primary);
  }
  .modal-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
  .modal-footer {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 12px 16px; border-top: 1px solid var(--border-subtle);
  }
  .row { display: flex; gap: 12px; }
  .row label { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .col { display: flex; flex-direction: column; gap: 4px; }
  .err {
    padding: 8px 12px;
    background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.3);
    border-radius: var(--radius-md); color: var(--danger); font-size: 12px;
  }
  .import-btn {
    align-self: flex-start;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
</style>
