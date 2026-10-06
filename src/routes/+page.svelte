<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import { app } from '$lib/stores/app.svelte';
  import { presentation } from '$lib/stores/presentation.svelte';
  import { buildExport } from '$lib/services/export';
  import { exportToPdf } from '$lib/services/pdf';
  import { isCancelledError, saveHtmlExport } from '$lib/services/save-html-export';
  import { importHtmlPresentation } from '$lib/services/import-html';
  import { openPath } from '@tauri-apps/plugin-opener';
  import { check } from '@tauri-apps/plugin-updater';
  import { relaunch } from '@tauri-apps/plugin-process';

  import SlidesPanel from '$lib/components/SlidesPanel.svelte';
  import Viewport from '$lib/components/Viewport.svelte';
  import ToolsPanel from '$lib/components/ToolsPanel.svelte';
  import AIPanel from '$lib/components/AIPanel.svelte';
  import HtmlEditor from '$lib/components/HtmlEditor.svelte';

  import Wrench from '@lucide/svelte/icons/wrench';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Code from '@lucide/svelte/icons/code';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import FileText from '@lucide/svelte/icons/file-text';
  import Download from '@lucide/svelte/icons/download';
  import Languages from '@lucide/svelte/icons/languages';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import Undo2 from '@lucide/svelte/icons/undo-2';
  import Redo2 from '@lucide/svelte/icons/redo-2';
  import FilePlus from '@lucide/svelte/icons/file-plus';
  import CloudSync from '@lucide/svelte/icons/cloud-sync';
  import Eye from '@lucide/svelte/icons/eye';

  let rightPanel = $state<'tools' | 'ai'>('tools');
  let exportBusy = $state(false);
  let projectBusy = $state(false);
  let previewBusy = $state(false);
  let updateBusy = $state(false);

  async function handleExportHtml(startSlideIndex?: number) {
    if (!presentation.slides.length) {
      app.notify(t('toast.noSlides'), 'error');
      return;
    }
    exportBusy = true;
    try {
      const result = await saveHtmlExport(
        null,
        presentation.slides,
        presentation.projectName,
        { startSlideIndex }
      );
      app.notify(
        t('toast.exportedTo', { path: result.outputDir, count: result.assetCount }),
        'success',
        5000
      );
      return result.htmlPath;
    } catch (e) {
      if (isCancelledError(e)) {
        app.notify(t('toast.exportCancelled'), 'info');
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        app.notify(`${t('toast.exportFailed')}: ${msg}`, 'error', 6000);
      }
    } finally {
      exportBusy = false;
    }
  }

  async function handleExportPdf(withoutLoader = false) {
    if (!presentation.slides.length) {
      app.notify(t('toast.noSlides'), 'error');
      return;
    }
    if (!withoutLoader)
      exportBusy = true;
    try {
      const built = await buildExport(presentation.slides, presentation.projectName, {
        inlineAssets: true
      });
      await exportToPdf(built.html, presentation.slides, presentation.projectName);
      app.notify(t('toast.exported'), 'success');
    } catch (e) {
      if (isCancelledError(e)) {
        app.notify(t('toast.exportCancelled'), 'info');
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        app.notify(`${t('toast.exportFailed')}: ${msg}`, 'error', 6000);
      }
    } finally {
      if (!withoutLoader)
        exportBusy = false;
    }
  }

  async function handleNew() {
    const ok = await app.confirm(t('actions.newProjectConfirm'), {
      confirmLabel: t('common.create'),
      cancelLabel: t('common.cancel')
    });
    if (!ok) return;

    presentation.resetProject();
    app.setLastProjectPath(null);
    app.notify(t('toast.projectReset'), 'success');
  }

  function toggleLang() {
    app.language = app.language === 'ru' ? 'en' : 'ru';
  }

  function onGlobalKey(e: KeyboardEvent) {
    if (e.key === 'F5' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+F5 — показ прямо в редакторе, с текущего слайда
        handlePreview(presentation.currentSlideIndex)
        return;
      }
      void handlePreview();
      return;
    }

    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    // Ctrl+Z — отмена, Ctrl+Shift+Z — повтор
    if (e.code === 'KeyZ') {
      e.preventDefault();
      if (e.shiftKey) presentation.redo();
      else presentation.undo();
      return;
    }

    // Ctrl+Y — альтернативный повтор (Windows-стиль)
    if (e.code === 'KeyY') {
      e.preventDefault();
      presentation.redo();
      return;
    }

    if (e.code === 'KeyS') {
      e.preventDefault();
      if (e.shiftKey) handleExportPdf(true);
      else handleExportHtml();
    }

    if (e.code === 'KeyO') {
      e.preventDefault();
      handleOpen();
      return;
    }
  }

  async function handleOpen() {
    if (projectBusy) return;
    projectBusy = true;
    try {
      const result = await importHtmlPresentation();
      if (!result) return;

      presentation.loadProject(result.name, result.slides);
      app.notify(t('toast.projectOpened', { name: result.name }), 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      app.notify(`${t('toast.projectOpenFailed')}: ${msg}`, 'error', 6000);
    } finally {
      projectBusy = false;
    }
  }

  async function handlePreview(startSlideIndex?: number) {
    previewBusy = true;
    const htmlPath = await handleExportHtml(startSlideIndex)
    if (typeof htmlPath === "string") {
      await openPath(htmlPath);
    }
    previewBusy = false;
  }

  async function handleCheckUpdates() {
    if (updateBusy) return;
    updateBusy = true;
    try {
      // check() возвращает null, если обновлений нет [citation:1]
      const update = await check();

      if (!update) {
        app.notify(t('toast.upToDate'), 'info');
        return;
      }

      // Подтверждение от пользователя
      const shouldUpdate = await app.confirm(
        t('toast.updateAvailable', {
          version: update.version,
          current: update.currentVersion
        }),
        { confirmLabel: t('common.update'), cancelLabel: t('common.cancel') }
      );

      if (!shouldUpdate) return;

      // Скачивание и установка
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            app.notify(t('toast.updateDownloading'), 'info');
            break;
          case 'Progress':
            // Можно обновлять прогресс в UI, если нужно
            break;
          case 'Finished':
            break;
        }
      });

      // После установки предлагаем перезапуск
      const shouldRestart = await app.confirm(t('toast.updateReadyRestart'), {
        confirmLabel: t('common.restart'),
        cancelLabel: t('common.later')
      });

      if (shouldRestart) {
        await relaunch(); // [citation:3][citation:9]
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      app.notify(`${t('toast.updateFailed')}: ${msg}`, 'error', 6000);
    } finally {
      updateBusy = false;
    }
  }

  onMount(() => {
    if (presentation.slides.length === 0) {
      presentation.addSlide();
    }
  });
</script>

<svelte:window onkeydown={onGlobalKey} />

<div class="app-shell">
  <header class="app-toolbar">
    <div class="toolbar-left">
      <svg width="36" height="20" viewBox="0 0 72 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 0C58.6667 0 72 9.33333 72 28C72 46.6667 58.6667 56 32 56H0V42H32C38.8014 42 44.2352 40.9913 48.0293 38.7148C51.986 36.3407 54 32.6774 54 28C54 23.3226 51.986 19.6593 48.0293 17.2852C44.2352 15.0087 38.8014 14 32 14H0V0H32ZM0 18H32C38.5317 18 43.0981 18.9914 45.9707 20.7148C48.6805 22.3407 50 24.6776 50 28C50 31.3224 48.6805 33.6593 45.9707 35.2852C43.0981 37.0086 38.5317 38 32 38H0V18Z" fill="#7C6CF0"/>
      </svg>
      <div class="app-title">
        <span>Declare</span>
      </div>
      <button
        class="ghost icon-only"
        onclick={handleOpen}
        disabled={projectBusy}
        title={t('actions.openProject')}
        aria-label={t('actions.openProject')}
      >
        <FolderOpen size={15} strokeWidth={1.75} />
      </button>
      <button
        class="ghost icon-only"
        onclick={handleNew}
        title={t('actions.newProject')}
        aria-label={t('actions.newProject')}
      >
        <FilePlus size={15} strokeWidth={1.75} />
      </button>
      <button
        class="ghost icon-only"
        onclick={handleCheckUpdates}
        disabled={updateBusy}
        title={t('actions.checkUpdates')}
        aria-label={t('actions.checkUpdates')}
      >
        {#if updateBusy}
          <Loader2 size={15} strokeWidth={1.75} class="spin-animate" />
        {:else}
          <CloudSync size={15} strokeWidth={1.75} />
        {/if}
      </button>
      <input
        class="project-name"
        type="text"
        bind:value={presentation.projectName}
        aria-label={t('app.projectName')}
      />
    </div>

    <div class="toolbar-center">
      <div class="segmented">
        <button
          class:active={rightPanel === 'tools'}
          onclick={() => (rightPanel = 'tools')}
        >
          <Wrench size={13} strokeWidth={1.75} />
          {t('tools.title')}
        </button>
        <button
          class:active={rightPanel === 'ai'}
          onclick={() => (rightPanel = 'ai')}
        >
          <Sparkles size={13} strokeWidth={1.75} />
          {t('toolbar.ai')}
        </button>
      </div>
    </div>

    <div class="toolbar-right">
        <button
            class="ghost icon-only"
            onclick={() => presentation.undo()}
            disabled={!presentation.canUndo}
            title={t('actions.undo')}
            aria-label={t('actions.undo')}
        >
            <Undo2 size={15} strokeWidth={1.75} />
        </button>

    <button
        class="ghost icon-only"
        onclick={() => presentation.redo()}
        disabled={!presentation.canRedo}
        title={t('actions.redo')}
        aria-label={t('actions.redo')}
    >
        <Redo2 size={15} strokeWidth={1.75} />
    </button>
    <button
        onclick={()=>handlePreview()}
        disabled={previewBusy || exportBusy}
        title={t('text.preview')}
    >
        {#if previewBusy}
            <Loader2 size={14} strokeWidth={1.75} class="spin-animate" />
        {:else}
            <Eye size={14} strokeWidth={1.75} />
        {/if}
        {t('text.preview')}
    </button>
      <button onclick={() => app.openHtmlEditor()} title={t('actions.htmlEdit')}>
        <Code size={14} strokeWidth={1.75} />
        {t('actions.htmlEdit')}
      </button>

      <button onclick={()=>handleExportPdf()} disabled={exportBusy}>
        <FileText size={14} strokeWidth={1.75} />
        {t('actions.exportPdf')}
      </button>

      <button class="primary" onclick={()=>handleExportHtml()} disabled={exportBusy}>
        {#if exportBusy}
          <Loader2 size={14} strokeWidth={1.75} class="spin-animate" />
        {:else}
          <Download size={14} strokeWidth={1.75} />
        {/if}
        {t('actions.exportHtml')}
      </button>

      <button class="ghost lang-btn" onclick={toggleLang} title={t('settings.language')}>
        <Languages size={14} strokeWidth={1.75} />
        {app.language === 'ru' ? 'EN' : 'RU'}
      </button>
    </div>
  </header>

  <main class="app-body">
    <aside class="col-left">
      <SlidesPanel />
    </aside>

    <section class="col-center">
      <Viewport />
    </section>

    <aside class="col-right">
      {#if rightPanel === 'tools'}
        <ToolsPanel />
      {:else}
        <AIPanel />
      {/if}
    </aside>
  </main>
</div>

{#if app.showHtmlEditor}
  <HtmlEditor onClose={() => app.closeHtmlEditor()} />
{/if}

<style>
  .app-shell {
    height: 100vh;
    max-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    min-height: 0;
    overflow: hidden;
  }

  /* ---------- Верхняя панель ---------- */
  .app-toolbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-subtle);
    height: 52px;
    flex-shrink: 0;
  }

  .toolbar-left,
  .toolbar-center,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .toolbar-right {
    justify-content: flex-end;
  }

  .app-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.02em;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .project-name {
    max-width: 220px;
    padding: 6px 10px;
    font-size: 13px;
    background: transparent;
    border-color: transparent;
  }
  .project-name:hover {
    border-color: var(--border-subtle);
  }

  .segmented {
    display: inline-flex;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 2px;
  }

  .segmented button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    background: transparent;
    padding: 6px 14px;
    font-size: 12px;
    color: var(--text-secondary);
    border-radius: calc(var(--radius-md) - 2px);
  }
  .segmented button.active {
    background: var(--accent-primary);
    color: #fff;
    box-shadow: var(--shadow-sm);
  }

  .lang-btn {
    padding: 6px 10px;
    font-size: 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ---------- Тело ---------- */
  .app-body {
    flex: 1;
    display: grid;
    grid-template-columns: 220px 1fr 300px;
    min-height: 0;
    overflow: hidden;
  }

  .col-left,
  .col-right {
    min-height: 0;
    overflow: hidden;
    background: var(--bg-secondary);
  }

  .col-left {
    border-right: 1px solid var(--border-subtle);
  }

  .col-right {
    border-left: 1px solid var(--border-subtle);
  }

  .col-center {
    min-width: 0;
    min-height: 0;
    display: flex;
    overflow: hidden;
    max-height: 100%;
  }

  .icon-only {
    padding: 6px 8px;
    min-width: 32px;
    justify-content: center;
  }
</style>
