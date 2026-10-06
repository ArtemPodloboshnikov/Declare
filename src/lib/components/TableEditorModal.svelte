<script lang="ts">
  import { t } from '$lib/i18n';
  import { pickFile, readTextFile, readXlsx, parseCsv } from '$lib/services/file-import';
  import Checkbox from './Checkbox.svelte';
  import { X, ClipboardList, Download, Plus } from '@lucide/svelte';

  let {
    onClose,
    onSubmit
  }: {
    onClose: () => void;
    onSubmit: (data: {
      headers: string[];
      rows: string[][];
      hasHeader: boolean;
    }) => void;
  } = $props();

  let hasHeader = $state(true);
  let grid = $state<string[][]>([
    ['Заголовок 1', 'Заголовок 2', 'Заголовок 3'],
    ['', '', ''],
    ['', '', '']
  ]);

  let importError = $state<string | null>(null);

  function addRow() {
    grid = [...grid, new Array(grid[0].length).fill('')];
  }

  function addCol() {
    grid = grid.map(row => [...row, '']);
  }

  function removeRow(i: number) {
    if (grid.length <= 1) return;
    grid = grid.filter((_, idx) => idx !== i);
  }

  function removeCol(j: number) {
    if (grid[0].length <= 1) return;
    grid = grid.map(row => row.filter((_, idx) => idx !== j));
  }

  function updateCell(i: number, j: number, value: string) {
    grid[i][j] = value;
    grid = grid; // триггерим реактивность
  }

  // ---------- Вставка из Excel / CSV через paste ----------
  function onPaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const parsed = parseCsv(text);
    if (!parsed.length) return;
    // нормализуем ширину
    const width = Math.max(...parsed.map(r => r.length), grid[0].length);
    const normalized = parsed.map(r => {
      const copy = [...r];
      while (copy.length < width) copy.push('');
      return copy;
    });
    // дополняем существующую сетку
    while (grid.length < normalized.length) grid.push(new Array(width).fill(''));
    for (let i = 0; i < normalized.length; i++) {
      for (let j = 0; j < width; j++) {
        grid[i][j] = normalized[i][j] ?? '';
      }
    }
    grid = [...grid];
  }

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
      const width = Math.max(...parsed.map(r => r.length));
      const normalized = parsed.map(r => {
        const copy = [...r];
        while (copy.length < width) copy.push('');
        return copy;
      });
      grid = normalized;
    } catch (e) {
      importError = `${t('table.importFailed')}: ${e instanceof Error ? e.message : e}`;
    }
  }

  function submit() {
    const headers = hasHeader ? grid[0] : grid[0].map((_, i) => `Col ${i + 1}`);
    const rows = hasHeader ? grid.slice(1) : grid;
    onSubmit({ headers, rows, hasHeader });
  }
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation">
  <div class="modal table-modal" onclick={(e) => e.stopPropagation()} role="presentation">
    <header class="modal-header">
      <h3><ClipboardList size={16} /> {t('table.title')}</h3>
      <button class="ghost" onclick={onClose} aria-label={t('common.cancel')}>
        <X size={16} />
      </button>
    </header>

    <div class="modal-body">
      <div class="table-toolbar">
        <Checkbox bind:checked={hasHeader} label={t('table.firstRowHeader')} />
        <div class="spacer"></div>
        <button onclick={importFile}>
          <Download size={14} /> {t('table.import')}
        </button>
        <button onclick={addRow}>
          <Plus size={14} /> {t('table.row')}
        </button>
        <button onclick={addCol}>
          <Plus size={14} /> {t('table.col')}
        </button>
      </div>

      {#if importError}
        <div class="err">{importError}</div>
      {/if}

      <div
        class="grid-wrap"
        onpaste={onPaste}
        role="presentation"
        tabindex="0"
      >
        <table class="data-grid">
          <tbody>
            {#each grid as row, i (i)}
              <tr>
                {#each row as cell, j (j)}
                  <td>
                    <input
                      type="text"
                      value={cell}
                      oninput={(e) => updateCell(i, j, (e.currentTarget as HTMLInputElement).value)}
                      class:header-cell={hasHeader && i === 0}
                    />
                    {#if hasHeader && i === 0}
                      <button
                        class="del-col"
                        title={t('table.removeCol')}
                        onclick={() => removeCol(j)}
                      >
                        <X size={10} />
                      </button>
                    {/if}
                  </td>
                {/each}
                <td class="row-actions">
                  <button
                    class="del-row"
                    title={t('table.removeRow')}
                    onclick={() => removeRow(i)}
                    disabled={grid.length <= 1}
                  >
                    <X size={10} />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <p class="hint">{t('table.pasteHint')}</p>
    </div>

    <footer class="modal-footer">
      <button class="ghost" onclick={onClose}>{t('common.cancel')}</button>
      <button class="primary" onclick={submit}>{t('common.insert')}</button>
    </footer>
  </div>
</div>

<style>
  .table-modal { width: min(90vw, 780px); }

  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid var(--border-subtle);
  }
  .modal-header h3 {
    font-size: 14px; font-weight: 600; justify-content: center;
    display: flex; align-items: center; gap: 6px;
  }

  .modal-body { padding: 14px 16px; overflow: auto; max-height: 60vh; }

  .modal-footer {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 12px 16px; border-top: 1px solid var(--border-subtle);
  }

  .table-toolbar {
    display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
  }
  .table-toolbar .spacer { flex: 1; }
  .table-toolbar button {
    padding: 6px 10px; font-size: 12px;
    display: inline-flex; align-items: center; gap: 4px;
  }

  .err {
    padding: 8px 12px; margin-bottom: 10px;
    background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.3);
    border-radius: var(--radius-md); color: var(--danger); font-size: 12px;
  }

  .grid-wrap {
    overflow: auto; max-height: 40vh;
    border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
    outline: none;
  }
  .grid-wrap:focus { border-color: var(--accent-primary); }

  .data-grid { border-collapse: collapse; width: 100%; }
  .data-grid td {
    padding: 0; border: 1px solid var(--border-subtle); position: relative;
  }
  .data-grid input {
    border: none; background: transparent; width: 120px;
    padding: 6px 8px; font-size: 12px; border-radius: 0;
  }
  .data-grid input:focus { box-shadow: none; background: var(--bg-elevated); }
  .data-grid input.header-cell {
    font-weight: 600; background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .row-actions { width: 28px; text-align: center; }
  .del-row, .del-col {
    width: 18px; height: 18px; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: transparent; border: none; color: var(--text-muted);
    position: absolute; top: 2px; right: 2px; opacity: 0;
    transition: opacity var(--transition-fast);
    cursor: pointer;
  }
  .data-grid td:hover .del-row,
  .data-grid td:hover .del-col { opacity: 1; }
  .del-row:hover, .del-col:hover { color: var(--danger); }
  .row-actions .del-row { position: static; opacity: 0.4; }
  .row-actions .del-row:hover { opacity: 1; }
  .row-actions .del-row:disabled { opacity: 0.2; cursor: not-allowed; }

  .hint { margin-top: 8px; }
</style>
