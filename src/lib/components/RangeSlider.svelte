<script lang="ts">
  let {
    value = $bindable<[number, number]>([0, 100]),
    min = 0,
    max = 100,
    step = 0.1,
    disabled = false,
    formatValue = (v: number) => String(v),
    onchange
  }: {
    value: [number, number];
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    formatValue?: (v: number) => string;
    onchange?: (v: [number, number]) => void;
  } = $props();

  let low = $state(value[0]);
  let high = $state(value[1]);

  // Синхронизация с внешним value
  $effect(() => {
    const [vLow, vHigh] = value;
    if (vLow !== low) low = vLow;
    if (vHigh !== high) high = vHigh;
  });

  const span = $derived(Math.max(max - min, step) || 1);
  const lowPct = $derived(clamp(((low - min) / span) * 100, 0, 100));
  const highPct = $derived(clamp(((high - min) / span) * 100, 0, 100));

  let trackEl: HTMLDivElement;
  let dragging = $state<'low' | 'high' | null>(null);

  function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
  }

  /** Округление до шага */
  function snap(v: number): number {
    if (step <= 0) return v;
    return Math.round(v / step) * step;
  }

  function pctToValue(pct: number): number {
    const raw = min + (pct / 100) * span;
    return snap(clamp(raw, min, max));
  }

  function valueFromClientX(clientX: number): number {
    if (!trackEl) return min;
    const rect = trackEl.getBoundingClientRect();
    const pct = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    return pctToValue(pct);
  }

  function startDrag(handle: 'low' | 'high', e: PointerEvent) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = handle;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    e.preventDefault();

    const v = valueFromClientX(e.clientX);

    if (dragging === 'low') {
      low = Math.min(v, high);
    } else {
      high = Math.max(v, low);
    }

    // Живое обновление — value меняется без commit
    value = [low, high];
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    const handle = dragging;
    dragging = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);

    // Коммит в стор — только по окончании перетаскивания
    onchange?.([low, high]);
  }

  function onTrackClick(e: MouseEvent) {
    // Клик по треку не обрабатываем — только ползунки
    e.stopPropagation();
  }
</script>

<div
  class="range-slider"
  class:disabled
  class:dragging={Boolean(dragging)}
  style="--low: {lowPct}%; --high: {highPct}%;"
>
  <!-- Трек -->
  <div
    class="track"
    bind:this={trackEl}
    onclick={onTrackClick}
    role="presentation"
  >
    <div class="track-active"></div>
  </div>

  <!-- Левый ползунок -->
  <div
    class="handle handle-low"
    class:active={dragging === 'low'}
    style="left: {lowPct}%;"
    onpointerdown={(e) => startDrag('low', e)}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    role="slider"
    tabindex={disabled ? -1 : 0}
    aria-valuemin={min}
    aria-valuemax={high}
    aria-valuenow={low}
    aria-label="Start"
  >
    <div class="handle-dot"></div>
    <div class="handle-label">{formatValue(low)}</div>
  </div>

  <!-- Правый ползунок -->
  <div
    class="handle handle-high"
    class:active={dragging === 'high'}
    style="left: {highPct}%;"
    onpointerdown={(e) => startDrag('high', e)}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    role="slider"
    tabindex={disabled ? -1 : 0}
    aria-valuemin={low}
    aria-valuemax={max}
    aria-valuenow={high}
    aria-label="End"
  >
    <div class="handle-dot"></div>
    <div class="handle-label">{formatValue(high)}</div>
  </div>
</div>

<style>
  .range-slider {
    position: relative;
    width: 100%;
    /* 4px — трек, + 8px отступ сверху, + 20px подписи снизу */
    height: 40px;
    user-select: none;
    touch-action: none;
    box-sizing: border-box;
  }

  .range-slider.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  /* ---------- Трек ---------- */
  .track {
    position: absolute;
    left: 0;
    right: 0;
    top: 12px;
    height: 4px;
    background: var(--bg-primary);
    border-radius: 2px;
    cursor: default;
  }

  .track-active {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--low);
    right: calc(100% - var(--high));
    background: var(--accent-primary);
    border-radius: 2px;
    pointer-events: none;
  }

  /* ---------- Ползунки ---------- */
  .handle {
    position: absolute;
    top: 12px;
    /* Центрируем точку ползунка на треке */
    transform: translate(-50%, -50%);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    z-index: 2;
    touch-action: none;
  }

  .handle.active {
    cursor: grabbing;
    z-index: 5;
  }

  .handle:focus-visible {
    outline: none;
  }

  .handle:focus-visible .handle-dot {
    box-shadow: 0 0 0 3px var(--accent-dim);
  }

  .handle-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent-primary);
    border: 2px solid var(--bg-secondary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
    pointer-events: none;
  }

  .handle:hover .handle-dot {
    transform: scale(1.15);
  }

  .handle.active .handle-dot {
    transform: scale(1.2);
    box-shadow: 0 0 0 4px var(--accent-dim);
  }

  /* ---------- Подписи ---------- */
  .handle-label {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    pointer-events: none;
    transition: color var(--transition-fast);
  }

  .handle.active .handle-label {
    color: var(--accent-primary);
  }

  /* Отключаем выделение текста по всему слайдеру во время drag */
  .range-slider.dragging {
    cursor: grabbing;
  }
</style>
