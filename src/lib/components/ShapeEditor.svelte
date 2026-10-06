<script lang="ts">
  import { presentation, type SlideElement } from '$lib/stores/presentation.svelte';
  import {
    parsePathPoints,
    buildPath,
    insertPointAt,
    type PathPoint
  } from '$lib/services/path-editor';
  import { getShapePath } from '$lib/services/shapes';

  let { element }: { element: SlideElement } = $props();

  let svgEl: SVGSVGElement;

  // Локальное состояние точек для плавного drag
  let points = $state<PathPoint[]>([]);
  let closed = $state(false);

  let dragIndex = $state<number | null>(null);
  let dragStart = $state<{
    // координаты курсора в системе viewBox (0..100) в момент старта
    x: number;
    y: number;
    // исходные координаты точки
    origX: number;
    origY: number;
  } | null>(null);

  // ---------- Парсинг исходного пути ----------
  $effect(() => {
    // Не перетираем локальные точки, пока идёт drag
    if (dragIndex !== null) return;

    const d =
      element.shape?.customPath ??
      getShapePath(element.shape?.kind ?? 'rect');

    const parsed = parsePathPoints(d);
    if (parsed && parsed.length > 0) {
      points = parsed;
      closed = /[Zz]/.test(d);
    } else {
      points = [];
      closed = false;
    }
  });

  // ---------- Преобразование координат ----------
  /**
   * Переводит клиентские координаты (clientX/clientY) в систему viewBox (0..100).
   * Работает при любом масштабе родителя и при preserveAspectRatio="none".
   */
  function clientToPath(clientX: number, clientY: number): { x: number; y: number } {
    if (!svgEl) return { x: 0, y: 0 };
    const rect = svgEl.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x, y };
  }

  // ---------- Коммит изменений ----------
  function commit() {
    const d = buildPath(points, closed);
    presentation.updateElement(
      element.id,
      {
        shape: { ...(element.shape ?? { kind: 'rect' }), customPath: d }
      },
      true
    );
  }

  // ---------- Drag точек ----------
  function onPointDown(index: number, e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();

    const p = clientToPath(e.clientX, e.clientY);
    dragIndex = index;
    dragStart = {
      x: p.x,
      y: p.y,
      origX: points[index].x,
      origY: points[index].y
    };
  }

  function onPointMove(e: PointerEvent) {
    if (dragIndex === null || !dragStart) return;
    if (!points[dragIndex]) return;

    const p = clientToPath(e.clientX, e.clientY);
    const dx = p.x - dragStart.x;
    const dy = p.y - dragStart.y;

    points[dragIndex] = {
      x: dragStart.origX + dx,
      y: dragStart.origY + dy,
      isMove: points[dragIndex].isMove
    };
    // триггерим реактивность
    points = [...points];
    commit();
  }

  function onPointUp() {
    if (dragIndex === null) return;
    dragIndex = null;
    dragStart = null;
    presentation.commitPendingHistory();
  }

  // ---------- Добавление точки по клику на середину сегмента ----------
  function onSegmentClick(indexA: number, indexB: number, e: MouseEvent) {
    e.stopPropagation();
    points = insertPointAt(points, indexA, indexB);
    commit();
    presentation.commitPendingHistory();
  }

  // ---------- Середины сегментов ----------
  function getSegmentMidpoints(): { x: number; y: number; a: number; b: number }[] {
    const result: { x: number; y: number; a: number; b: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      result.push({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        a: i,
        b: i + 1
      });
    }
    if (closed && points.length > 2) {
      const a = points[points.length - 1];
      const b = points[0];
      result.push({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        a: points.length - 1,
        b: 0
      });
    }
    return result;
  }

  const midpoints = $derived(getSegmentMidpoints());
  const pathD = $derived(buildPath(points, closed));
</script>

<!-- Глобальные обработчики: drag продолжается, даже если курсор ушёл с круга -->
<svelte:window
  onpointermove={onPointMove}
  onpointerup={onPointUp}
  onpointercancel={onPointUp}
/>

<div class="shape-editor">
  <svg
    bind:this={svgEl}
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
    class="editor-svg"
  >
    <!-- Контур (только линии, без заливки) -->
    <path
      d={pathD}
      fill="none"
      stroke="var(--accent-primary)"
      stroke-width="1"
      vector-effect="non-scaling-stroke"
      stroke-dasharray="3 2"
    />

    <!-- Точки -->
    {#each points as p, i (i)}
      <circle
        cx={p.x}
        cy={p.y}
        r="2.5"
        fill={dragIndex === i ? 'var(--accent-primary)' : 'var(--bg-secondary)'}
        stroke="var(--accent-primary)"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
        class="point"
        class:dragging={dragIndex === i}
        onpointerdown={(e) => onPointDown(i, e)}
        role="presentation"
      />
    {/each}

    <!-- Середины сегментов для добавления новых точек -->
    {#each midpoints as m (`${m.a}-${m.b}`)}
      <circle
        cx={m.x}
        cy={m.y}
        r="1.5"
        fill="transparent"
        stroke="var(--accent-hover)"
        stroke-width="0.6"
        vector-effect="non-scaling-stroke"
        class="midpoint"
        onclick={(e) => onSegmentClick(m.a, m.b, e)}
        role="presentation"
      />
    {/each}
  </svg>
</div>

<style>
  .shape-editor {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 20;
  }

  .editor-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  .point,
  .midpoint {
    pointer-events: all;
  }

  .point {
    cursor: grab;
  }

  .point.dragging,
  .point:active {
    cursor: grabbing;
  }

  .midpoint {
    cursor: crosshair;
  }

  .midpoint:hover {
    fill: var(--accent-primary);
  }
</style>
