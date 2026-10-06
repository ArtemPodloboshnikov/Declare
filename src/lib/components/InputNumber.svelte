<script lang="ts">
  let {
    value = $bindable(),
    min = -Infinity,
    max = Infinity,
    step = 1,
    precision = 0,
    suffix = '',
    disabled = false,
    onchange
  }: {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    precision?: number;
    suffix?: string;
    disabled?: boolean;
    onchange?: (v: number) => void;
  } = $props();

  let inputEl: HTMLInputElement;

  const canDecrease = $derived(!disabled && value > min);
  const canIncrease = $derived(!disabled && value < max);

  function clamp(v: number): number {
    if (Number.isNaN(v)) return min;
    const clamped = Math.max(min, Math.min(max, v));
    return precision > 0
      ? Number(clamped.toFixed(precision))
      : Math.round(clamped);
  }

  function commit(v: number, force = false) {
    const next = clamp(v);
    if (next !== value || force) {
      value = next;
      onchange?.(next);
    }
  }

  function stepBy(delta: number) {
    if (disabled) return;
    commit(value + delta);
  }

  function onInput(e: Event) {
    const raw = (e.currentTarget as HTMLInputElement).value;
    const parsed = raw === '' ? min : Number(raw);
    if (!Number.isNaN(parsed)) {
      // не коммитим до blur/Enter, чтобы не мешать вводу
      value = parsed;
    }
  }

  function onBlur() {
    commit(value, true);
    if (inputEl) inputEl.value = String(value);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      stepBy(e.shiftKey ? step * 10 : step);
      if (inputEl) inputEl.value = String(value);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stepBy(e.shiftKey ? -step * 10 : -step);
      if (inputEl) inputEl.value = String(value);
    } else if (e.key === 'Enter') {
     e.preventDefault();
     commit(value, true);
     if (inputEl) inputEl.value = String(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Откатываем к последнему валидному
      if (inputEl) inputEl.value = String(value);
      inputEl?.blur();
    }
  }
</script>

<div class="input-number" class:disabled>
  <button
    type="button"
    class="step-btn"
    onclick={() => stepBy(-step)}
    disabled={!canDecrease}
    aria-label="Decrease"
    tabindex="-1"
  >−</button>

  <div class="field">
    <input
      bind:this={inputEl}
      type="number"
      min={min === -Infinity ? undefined : min}
      max={max === Infinity ? undefined : max}
      step={step}
      {disabled}
      value={value}
      oninput={onInput}
      onblur={onBlur}
      onkeydown={onKeyDown}
      aria-valuemin={min === -Infinity ? undefined : min}
      aria-valuemax={max === Infinity ? undefined : max}
      aria-valuenow={value}
    />
    {#if suffix}
      <span class="suffix">{suffix}</span>
    {/if}
  </div>

  <button
    type="button"
    class="step-btn"
    onclick={() => stepBy(step)}
    disabled={!canIncrease}
    aria-label="Increase"
    tabindex="-1"
  >+</button>
</div>

<style>
  .input-number {
    display: flex;
    align-items: stretch;
    gap: 4px;
    width: 100%;
  }

  .input-number.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .step-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    width: 32px;
    flex-shrink: 0;
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast);
  }

  .step-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    border-color: var(--border-strong);
  }

  .step-btn:active:not(:disabled) {
    background: var(--accent-dim);
    border-color: var(--accent-primary);
  }

  .step-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .field {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
  }

  input {
    width: 100%;
    height: 34px;
    padding: 7px 10px;
    text-align: center;
    font-family: inherit;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    outline: none;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);

    /* Убираем нативные стрелки */
    -moz-appearance: textfield;
    appearance: textfield;
  }

  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input:focus {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--accent-dim);
  }

  .suffix {
    position: absolute;
    right: 10px;
    font-size: 12px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    pointer-events: none;
  }
</style>
