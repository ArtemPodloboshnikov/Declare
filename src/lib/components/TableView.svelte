<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    DEFAULT_TABLE_SETTINGS,
    presentation,
    type SlideElement
  } from '$lib/stores/presentation.svelte';

  let { element }: { element: SlideElement } = $props();

  // ---------- Данные ----------
  const data = $derived.by<{ headers: string[]; rows: string[][] }>(() => {
    try {
      return JSON.parse(element.content || '{"headers":[],"rows":[]}');
    } catch {
      return { headers: [], rows: [] };
    }
  });

  const settings = $derived({
    ...DEFAULT_TABLE_SETTINGS,
    ...(element.table ?? {})
  });

  // ---------- Стили ----------
  const tableStyle = $derived(`
    font-size: ${settings.fontSize}px;
    color: ${settings.cellColor};
    border-color: ${settings.borderColor};
  `);

  const thStyle = $derived(`
    background: ${settings.headerBg};
    color: ${settings.headerColor};
    border: ${settings.borderWidth}px solid ${settings.borderColor};
    text-align: ${settings.textAlign};
    padding: ${settings.paddingY}px ${settings.paddingX}px;
  `);

  const tdStyle = $derived(`
    color: ${settings.cellColor};
    border: ${settings.borderWidth}px solid ${settings.borderColor};
    text-align: ${settings.textAlign};
    padding: ${settings.paddingY}px ${settings.paddingX}px;
  `);

  // ---------- Редактирование ----------
  type CellRef = { type: 'header'; col: number } | { type: 'body'; row: number; col: number };

  let editing = $state<CellRef | null>(null);
  let editValue = $state('');
  let inputEl: HTMLInputElement | null = null;

  function isEditing(ref: CellRef): boolean {
    if (!editing) return false;
    if (ref.type === 'header') return editing.type === 'header' && editing.col === ref.col;
    return (
      editing.type === 'body' &&
      editing.row === ref.row &&
      editing.col === ref.col
    );
  }

  async function startEdit(ref: CellRef, currentValue: string) {
    editing = ref;
    editValue = currentValue;
    await tick();
    inputEl?.focus();
    inputEl?.select();
  }

  function commitEdit() {
    if (!editing) return;

    const next = JSON.parse(JSON.stringify(data)) as {
      headers: string[];
      rows: string[][];
    };

    if (editing.type === 'header') {
      next.headers[editing.col] = editValue;
    } else {
      next.rows[editing.row][editing.col] = editValue;
    }

    presentation.updateElement(element.id, {
      content: JSON.stringify(next)
    });
    presentation.commitPendingHistory();

    editing = null;
    editValue = '';
    inputEl = null;
  }

  function cancelEdit() {
    editing = null;
    editValue = '';
    inputEl = null;
  }

  function onInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
    // Останавливаем всплытие, чтобы Viewport не удалял элемент
    e.stopPropagation();
  }

  function onInputBlur() {
    commitEdit();
  }
</script>

<div class="table-wrap">
  <table style={tableStyle}>
    {#if settings.showHeader}
      <thead>
        <tr>
          {#each data.headers as h, j (j)}
            <th
              style={thStyle}
              ondblclick={() => startEdit({ type: 'header', col: j }, h)}
              role="presentation"
            >
              {#if isEditing({ type: 'header', col: j })}
                <input
                  bind:this={inputEl}
                  bind:value={editValue}
                  onkeydown={onInputKeydown}
                  onblur={onInputBlur}
                  class="cell-input"
                  style="text-align: {settings.textAlign};"
                />
              {:else}
                {h}
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
    {/if}
    <tbody>
      {#each data.rows as row, i (i)}
        <tr style={settings.striped && i % 2 === 1 ? `background: ${settings.stripeColor}` : ''}>
          {#each row as cell, j (j)}
            <td
              style={tdStyle}
              ondblclick={() => startEdit({ type: 'body', row: i, col: j }, cell)}
              role="presentation"
            >
              {#if isEditing({ type: 'body', row: i, col: j })}
                <input
                  bind:this={inputEl}
                  bind:value={editValue}
                  onkeydown={onInputKeydown}
                  onblur={onInputBlur}
                  class="cell-input"
                  style="text-align: {settings.textAlign};"
                />
              {:else}
                {cell}
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-wrap {
    width: 100%;
    height: 100%;
    overflow: auto;
    padding: 8px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    border-collapse: collapse;
  }

  th {
    font-weight: 600;
  }

  .cell-input {
    width: 100%;
    padding: 0;
    margin: 0;
    border: none;
    outline: none;
    background: transparent;
    font: inherit;
    color: inherit;
    box-sizing: border-box;
  }

  .cell-input:focus {
    outline: none;
  }
</style>
