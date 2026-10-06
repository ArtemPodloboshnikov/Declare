<script lang="ts">
  import { SHAPES } from '$lib/services/shapes';
  import { t } from '$lib/i18n';
  import { X } from '@lucide/svelte';
  import type { ShapeKind } from '$lib/stores/presentation.svelte';

  let {
    onClose,
    onPick
  }: {
    onClose: () => void;
    onPick: (kind: ShapeKind) => void;
  } = $props();

  function pick(kind: string) {
    onPick(kind as ShapeKind);
  }
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation">
  <div
    class="modal shape-picker"
    onclick={(e) => e.stopPropagation()}
    role="presentation"
  >
    <header class="modal-header">
      <h3>{t('shapes.title')}</h3>
      <button class="ghost" onclick={onClose} aria-label={t('common.close')}>
        <X size={16} strokeWidth={1.75} />
      </button>
    </header>

    <div class="shape-grid">
      {#each SHAPES as s (s.kind)}
        <button
          type="button"
          class="shape-btn"
          onclick={() => pick(s.kind)}
          title={t(s.labelKey)}
        >
          <svg viewBox="0 0 100 100" width="40" height="40" aria-hidden="true">
            <path
              d={s.path}
              fill={s.outline ? 'none' : 'currentColor'}
              stroke={s.outline ? 'currentColor' : 'none'}
              stroke-width={s.outline ? 6 : 0}
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="shape-label">{t(s.labelKey)}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .shape-picker {
    width: min(90vw, 560px);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }
  .modal-header h3 {
    font-size: 14px;
    font-weight: 600;
  }

  .shape-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 16px;
    overflow-y: auto;
  }

  .shape-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
  }
  .shape-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  .shape-label {
    font-size: 11px;
    color: var(--text-muted);
    user-select: none;
  }
  .shape-btn:hover .shape-label {
    color: var(--text-primary);
  }
</style>
