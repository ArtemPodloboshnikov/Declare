<script lang="ts">
  import { DEFAULT_TABLE_SETTINGS, type SlideElement } from '$lib/stores/presentation.svelte';

  let { element }: { element: SlideElement } = $props();

  const data = $derived.by(() => {
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
</script>

<div class="table-wrap">
  <table style={tableStyle}>
    {#if settings.showHeader}
      <thead>
        <tr>
          {#each data.headers as h (h)}
            <th style={thStyle}>{h}</th>
          {/each}
        </tr>
      </thead>
    {/if}
    <tbody>
      {#each data.rows as row, i (i)}
        <tr style={settings.striped && i % 2 === 1 ? `background: ${settings.stripeColor}` : ''}>
          {#each row as cell, j (j)}
            <td style={tdStyle}>{cell}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-wrap { width: 100%; height: 100%; overflow: auto; padding: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-collapse: collapse; }
  th { font-weight: 600; }
</style>
