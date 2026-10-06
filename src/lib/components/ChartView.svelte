<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';
  import { ensureColors } from '$lib/services/chart-colors';
  import {
    DEFAULT_CHART_SETTINGS,
    type ChartSettings,
    type SlideElement
  } from '$lib/stores/presentation.svelte';
    import { isCircular } from '$lib/services/common';

  let { element }: { element: SlideElement } = $props();

  let canvas: HTMLCanvasElement;
  let chartInstance: Chart | null = null;

  const settings = $derived<ChartSettings>({
    ...DEFAULT_CHART_SETTINGS,
    ...(element.chart ?? {})
  });

  const data = $derived.by(() => {
    try {
      const parsed = JSON.parse(element.content || '{}');
      const labels: string[] = parsed.labels ?? [];
      const values: number[] = parsed.values ?? [];
      return {
        kind: (parsed.kind ?? 'bar') as 'bar' | 'line' | 'pie' | 'doughnut',
        labels,
        values,
        datasetLabel: parsed.datasetLabel ?? '',
        colors: ensureColors(labels.length, parsed.colors)
      };
    } catch {
      return {
        kind: 'bar' as const,
        labels: [] as string[],
        values: [] as number[],
        datasetLabel: '',
        colors: [] as string[]
      };
    }
  });

  function buildOptions(kind: string, s: ChartSettings): Chart['options'] {
    const showLegend = isCircular(kind) && s.showLegend;
    const showDatasetLabel = !isCircular(kind) && s.showDatasetLabel;

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: showLegend,
          labels: {
            color: s.legendColor,
            font: { size: s.legendSize }
          }
        },
        // Заголовок = имя серии. Для круговых отключаем (там легенда = имена сегментов).
        title: {
          display: showDatasetLabel && Boolean(data.datasetLabel),
          text: data.datasetLabel,
          color: s.datasetLabelColor,
          font: { size: s.datasetLabelSize }
        },
        tooltip: {
          titleColor: s.datasetLabelColor,
          bodyColor: s.datasetLabelColor,
          titleFont: { size: s.axisLabelSize },
          bodyFont: { size: s.axisLabelSize }
        }
      },
      scales: isCircular(kind)
        ? {}
        : {
            x: {
              ticks: {
                color: s.axisLabelColor,
                font: { size: s.axisLabelSize }
              },
              grid: { color: s.gridColor }
            },
            y: {
              ticks: {
                color: s.axisLabelColor,
                font: { size: s.axisLabelSize }
              },
              grid: { color: s.gridColor }
            }
          }
    };
  }

  function createChart() {
    if (!canvas) return;
    chartInstance = new Chart(canvas, {
      type: data.kind,
      data: {
        labels: data.labels,
        datasets: [{
          label: data.datasetLabel,
          data: data.values,
          backgroundColor: data.colors,
          borderColor: data.colors,
          borderWidth: 2
        }]
      },
      options: buildOptions(data.kind, settings)
    });
  }

  onMount(() => {
    createChart();
    return () => {
      chartInstance?.destroy();
      chartInstance = null;
    };
  });

  // Реактивное обновление
  $effect(() => {
    if (!chartInstance) return;
    const d = data;
    const s = settings;

    // Смена типа — пересоздаём
    if (chartInstance.config.type !== d.kind) {
      chartInstance.destroy();
      createChart();
      return;
    }

    // Обновляем данные
    chartInstance.data.labels = d.labels;
    if (chartInstance.data.datasets[0]) {
      chartInstance.data.datasets[0].data = d.values;
      chartInstance.data.datasets[0].label = d.datasetLabel;
      chartInstance.data.datasets[0].backgroundColor = d.colors;
      chartInstance.data.datasets[0].borderColor = d.colors;
    }

    // Обновляем опции (легенда, заголовок, шрифты)
    chartInstance.options = buildOptions(d.kind, s);

    chartInstance.update('none');
  });

  onDestroy(() => {
    chartInstance?.destroy();
  });
</script>

<div class="chart-wrap">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .chart-wrap {
    width: 100%;
    height: 100%;
    padding: 8px;
  }
</style>
