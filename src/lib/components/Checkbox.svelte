<script lang="ts">
  let {
    checked = $bindable(false),
    label = '',
    disabled = false,
    onchange
  }: {
    checked: boolean;
    label?: string;
    disabled?: boolean;
    onchange?: (v: boolean) => void;
  } = $props();

  function handleChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    checked = input.checked;
    onchange?.(checked);
  }
</script>

<label class="checkbox" class:disabled>
  <input
    type="checkbox"
    class="native"
    bind:checked
    {disabled}
    onchange={handleChange}
  />
  <span class="box" aria-hidden="true">
    {#if checked}
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
        <path
          d="M3 8.5L6.5 12L13 4.5"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    {/if}
  </span>
  {#if label}
    <span class="label">{label}</span>
  {/if}
</label>

<style>
  .checkbox {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    font-size: 12px;
    color: var(--text-secondary);
    transition: color var(--transition-fast);
  }

  .checkbox:hover:not(.disabled) {
    color: var(--text-primary);
  }

  .checkbox.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .native {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
    opacity: 0;
  }

  .native:focus-visible + .box {
    box-shadow: 0 0 0 3px var(--accent-dim);
  }

  .box {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    color: #fff;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .checkbox:hover:not(.disabled) .box {
    border-color: var(--accent-primary);
  }

  .native:checked + .box {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
  }

  .label {
    line-height: 1.2;
  }
</style>
