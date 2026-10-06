<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import { app } from '$lib/stores/app.svelte';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import { t } from '$lib/i18n';

  async function pickFolder() {
    const picked = await open({
      directory: true,
      multiple: false,
      title: t('export.pickFolder')
    });
    if (picked && !Array.isArray(picked)) {
      app.setExportRootDir(picked);
    }
  }
</script>

<div class="export-settings">
  <div class="panel-lbl">{t('export.folder')}</div>

  {#if app.exportRootDir}
    <div class="path" title={app.exportRootDir}>
        <div class="row" onclick={pickFolder} style="cursor: pointer;">
          <FolderOpen size={16} strokeWidth={1.75} />
          {app.exportRootDir}
        </div>
    </div>
  {:else}
    <div class="path muted">{t('export.notSet')}</div>
    <button class="primary" style="justify-content: center;" onclick={pickFolder}>
      {t('export.pickFolder')}
    </button>
  {/if}
</div>

<style>
  .export-settings {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid var(--border-subtle);
  }
  .path {
    font-size: 11px;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    word-break: break-all;
    font-family: var(--font-mono);
  }
  .path.muted {
    color: var(--text-muted);
    font-style: italic;
  }
  .row {
    display: flex;
    gap: 6px;
  }
</style>
