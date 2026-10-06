<script lang="ts" generics="T extends string">
  interface Option {
    value: T;
    label: string;
    /** Необязательный инлайн-стиль для превью (например, font-family) */
    style?: string;
  }

  let {
    value = $bindable(),
    options,
    placeholder = '',
    disabled = false,
    onchange
  }: {
    value: T;
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
    onchange?: (v: T) => void;
  } = $props();

  let open = $state(false);
  let rootEl: HTMLDivElement;

  const selected = $derived(options.find(o => o.value === value) ?? null);

  function toggle() {
    if (disabled) return;
    open = !open;
  }

  function pick(v: T) {
    value = v;
    open = false;
    onchange?.(v);
  }

  function onDocPointer(e: PointerEvent) {
    if (!open) return;
    const t = e.target as Node;
    if (rootEl && !rootEl.contains(t)) open = false;
  }

  function onKey(e: KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'Escape') {
      open = false;
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (!open) {
        e.preventDefault();
        open = true;
      }
    }
    if (!open) return;
    const idx = options.findIndex(o => o.value === value);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = options[Math.min(idx + 1, options.length - 1)];
      if (next) pick(next.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = options[Math.max(idx - 1, 0)];
      if (prev) pick(prev.value);
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener('pointerdown', onDocPointer, true);
      return () => document.removeEventListener('pointerdown', onDocPointer, true);
    }
  });
</script>

<div class="cselect" class:open class:disabled bind:this={rootEl}>
  <button
    type="button"
    class="cselect-trigger"
    onclick={toggle}
    onkeydown={onKey}
    disabled={disabled}
    aria-haspopup="listbox"
    aria-expanded={open}
  >
    <span class="cselect-value" style={selected?.style ?? ''}>
      {#if selected}
        {selected.label}
      {:else}
        <span class="placeholder">{placeholder}</span>
      {/if}
    </span>
    <span class="cselect-arrow" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <ul class="cselect-menu" role="listbox">
      {#each options as opt (opt.value)}
        <li>
          <button
            type="button"
            class="cselect-option"
            class:active={opt.value === value}
            onclick={() => pick(opt.value)}
            role="option"
            aria-selected={opt.value === value}
          >
            <span style={opt.style ?? ''}>{opt.label}</span>
            {#if opt.value === value}
              <span class="check">✓</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .cselect {
    position: relative;
    width: 100%;
    font-size: 13px;
  }

  .cselect-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    text-align: left;
    cursor: pointer;
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }
  .cselect-trigger:hover { background: var(--bg-hover); border-color: var(--border-strong); }
  .cselect.open .cselect-trigger {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--accent-dim);
  }
  .cselect.disabled .cselect-trigger {
    opacity: 0.5; cursor: not-allowed;
  }

  .cselect-value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .placeholder { color: var(--text-muted); font-style: italic; }

  .cselect-arrow {
    color: var(--text-muted);
    font-size: 20px;
    transition: transform var(--transition-fast);
  }
  .cselect.open .cselect-arrow { transform: rotate(180deg); }

  .cselect-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 260px;
    overflow-y: auto;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    z-index: 50;
    list-style: none;
    padding: 4px;
    margin: 0;
    animation: menuIn var(--transition-fast);
  }

  @keyframes menuIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .cselect-option {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    text-align: left;
    cursor: pointer;
    font-size: 13px;
  }
  .cselect-option:hover { background: var(--bg-hover); }
  .cselect-option.active {
    background: var(--accent-dim);
    color: var(--accent-primary);
    font-weight: 600;
  }
  .cselect-option .check { color: var(--accent-primary); font-size: 12px; }
</style>
