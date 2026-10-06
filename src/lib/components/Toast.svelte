<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n';

  const isConfirm = $derived(app.statusMessage?.kind === 'confirm');

  function onYes() {
    app.resolveConfirm(true);
  }

  function onNo() {
    app.resolveConfirm(false);
  }
</script>

{#if app.statusMessage}
  <div
    class="toast toast-{app.statusMessage.kind}"
    role={isConfirm ? 'alertdialog' : 'status'}
    aria-live={isConfirm ? 'assertive' : 'polite'}
  >
    <div class="toast-text">{app.statusMessage.text}</div>

    {#if isConfirm}
      <div class="toast-actions">
        <button class="toast-btn toast-btn-no" onclick={onNo}>
          {app.statusMessage.cancelLabel ?? t('common.no')}
        </button>
        <button class="toast-btn toast-btn-yes" onclick={onYes}>
          {app.statusMessage.confirmLabel ?? t('common.yes')}
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 20px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    font-size: 13px;
    color: var(--text-primary);
    z-index: 500;
    animation: toastIn var(--transition-base);
    max-width: min(90vw, 520px);
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .toast-text {
    flex: 1;
    min-width: 0;
  }

  .toast-success { border-color: var(--success); color: var(--success); }
  .toast-error   { border-color: var(--danger);  color: var(--danger); }
  .toast-info    { border-color: var(--info);    color: var(--info); }
  .toast-confirm {
    border-color: var(--accent-primary);
    color: var(--text-primary);
  }

  .toast-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .toast-btn {
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 500;
    border-radius: var(--radius-md);
    cursor: pointer;
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    color: var(--text-primary);
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast);
  }

  .toast-btn-no:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
  }

  .toast-btn-yes {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: #fff;
  }

  .toast-btn-yes:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  @keyframes toastIn {
    from { opacity: 0; transform: translate(-50%, 10px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }
</style>
