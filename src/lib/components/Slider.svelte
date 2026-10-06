<script lang="ts">
  let {
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    suffix = '',
    onchange,
    oninput
  }: {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    suffix?: string;
    onchange?: (v: number) => void;
    oninput?: (v: number) => void;
  } = $props();

  const percent = $derived(
    max === min ? 0 : ((value - min) / (max - min)) * 100
  );

  function onInput(e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value);
    oninput?.(v);
  }

  function onChange(e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value);
    onchange?.(v);
  }
</script>

<div class="slider" class:disabled style="--percent: {percent}%">
  <input
    type="range"
    {min}
    {max}
    {step}
    {disabled}
    value={Number(value)}
    oninput={onInput}
    onchange={onChange}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value}
  />
  {#if suffix}
    <span class="slider-value">{value}{suffix}</span>
  {/if}
</div>

<style>
  .slider {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  .slider :global(input[type="range"]) {
    flex: 1;
    min-width: 0;
    height: 24px;
    padding: 0;
    margin: 0;
    background: transparent;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;

    /* Принудительно сбрасываем всё, что могло унаследоваться из app.css */
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
  }

  .slider :global(input[type="range"]:focus),
  .slider :global(input[type="range"]:focus-visible),
  .slider :global(input[type="range"]:active) {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    background: transparent;
  }

  .slider :global(input[type="range"]:focus),
  .slider :global(input[type="range"]:focus-visible),
  .slider :global(input[type="range"]:active) {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    background: transparent;
  }

  .slider.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  input[type="range"] {
    flex: 1;
    min-width: 0;
    height: 24px;
    padding: 0;
    margin: 0;
    background: transparent;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    outline: none;
  }

  /* Трек — WebKit */
  input[type="range"]::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      var(--accent-primary) 0%,
      var(--accent-primary) var(--percent),
      var(--bg-tertiary) var(--percent),
      var(--bg-tertiary) 100%
    );
  }

  /* Ползунок — WebKit */
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    margin-top: -5px; /* (track_height / 2) - (thumb_height / 2) = 2 - 7 = -5 */
    border-radius: 50%;
    background: var(--accent-primary);
    border: 2px solid var(--bg-secondary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  }

  input[type="range"]:hover::-webkit-slider-thumb {
    transform: scale(1.15);
    box-shadow: 0 0 0 3px var(--accent-dim);
  }

  input[type="range"]:active::-webkit-slider-thumb {
    transform: scale(1.1);
    box-shadow: 0 0 0 4px var(--accent-dim);
  }

  /* Firefox */
  input[type="range"]::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: var(--bg-tertiary);
  }

  input[type="range"]::-moz-range-progress {
    height: 4px;
    border-radius: 2px;
    background: var(--accent-primary);
  }

  input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent-primary);
    border: 2px solid var(--bg-secondary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  }

  input[type="range"]:hover::-moz-range-thumb {
    transform: scale(1.15);
    box-shadow: 0 0 0 3px var(--accent-dim);
  }

  /* Убираем фокусное свечение */
  input[type="range"]:focus,
  input[type="range"]:focus-visible {
    outline: none;
    box-shadow: none;
  }

  input[type="range"]:focus::-webkit-slider-thumb {
    /* Только тонкая обводка, без раздутого outline */
    box-shadow: 0 0 0 2px var(--accent-dim);
  }

  .slider-value {
    font-size: 12px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    min-width: 28px;
    text-align: right;
    flex-shrink: 0;
  }
</style>
