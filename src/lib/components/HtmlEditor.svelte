<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { t } from '$lib/i18n';
  import { presentation } from '$lib/stores/presentation.svelte';
  import { CANVAS_H, CANVAS_W } from '$lib/stores/app.svelte';

  import Wand2 from '@lucide/svelte/icons/wand-2';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Columns2 from '@lucide/svelte/icons/columns-2';
  import X from '@lucide/svelte/icons/x';
  import Code from '@lucide/svelte/icons/code';
  import Eye from '@lucide/svelte/icons/eye';

  let {
    onClose
  }: {
    onClose: () => void;
  } = $props();

  const MIN_RATIO = 20;
  const MAX_RATIO = 80;
  const MIN_PREVIEW_SCALE = 1;

  // ---------- Состояние ----------
  let source = $state(presentation.getCurrentSlideHtml());
  let error = $state<string | null>(null);
  let dirty = $state(false);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let textareaEl: HTMLTextAreaElement;

  // Ресайз панелей
  let splitRatio = $state(50);
  let splitContainer: HTMLDivElement;
  let resizing = $state(false);

  // Превью
  let previewCanvas: HTMLDivElement;
  let previewObserver: ResizeObserver | null = null;
  let previewW = $state(0);
  let previewH = $state(0);
  let previewScale = $derived(previewW ? previewW / CANVAS_W : 1);

  // ---------- Превью: пересчёт размера ----------
  function updatePreviewSize() {
    if (!previewCanvas) return;
    const pad = 16;
    const availW = previewCanvas.clientWidth - pad * 2;
    const availH = previewCanvas.clientHeight - pad * 2;
    if (availW <= 0 || availH <= 0) return;

    const fitScale = Math.min(availW / CANVAS_W, availH / CANVAS_H);
    const scale = Math.max(MIN_PREVIEW_SCALE, fitScale);

    previewW = Math.round(CANVAS_W * scale);
    previewH = Math.round(CANVAS_H * scale);
  }

  // ---------- Ресайз панелей ----------
  function onSplitterDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizing = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onSplitterMove(e: PointerEvent) {
    if (!resizing || !splitContainer) return;
    const rect = splitContainer.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const pct = (px / rect.width) * 100;
    splitRatio = Math.max(MIN_RATIO, Math.min(MAX_RATIO, pct));
    requestAnimationFrame(updatePreviewSize);
  }

  function onSplitterUp(e: PointerEvent) {
    if (!resizing) return;
    resizing = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  function resetSplit() {
    splitRatio = 50;
    requestAnimationFrame(updatePreviewSize);
  }

  // ---------- Применение HTML ----------
  function applyDebounced() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      applyNow();
    }, 250);
  }

  function applyNow() {
    try {
      presentation.applySlideHtml(source);
      error = null;
      dirty = false;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  function onInput() {
    dirty = true;
    applyDebounced();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget as HTMLTextAreaElement;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const indent = '  ';
      source = source.slice(0, start) + indent + source.slice(end);
      queueMicrotask(() => {
        ta.selectionStart = ta.selectionEnd = start + indent.length;
      });
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      applyNow();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  }

  function handleClose() {
    if (dirty) applyNow();
    onClose();
  }

  function reset() {
    source = presentation.getCurrentSlideHtml();
    error = null;
    dirty = false;
  }

  function format() {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<root>${source}</root>`, 'text/html');
      const root = doc.querySelector('root');
      if (!root) return;
      source = formatNode(root, 0).trim();
      dirty = true;
      applyDebounced();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  function formatNode(node: Node, depth: number): string {
    const indent = '  '.repeat(depth);
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').trim();
      return text ? `${indent}${text}\n` : '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const attrs = Array.from(el.attributes)
      .map(a => `${a.name}="${a.value.replace(/"/g, '&quot;')}"`)
      .join(' ');

    const open = attrs
      ? `<${el.tagName.toLowerCase()} ${attrs}>`
      : `<${el.tagName.toLowerCase()}>`;
    const close = `</${el.tagName.toLowerCase()}>`;

    if (el.children.length === 0) {
      const text = (el.textContent ?? '').trim();
      return text
        ? `${indent}${open}${text}${close}\n`
        : `${indent}${open}${close}\n`;
    }

    const children = Array.from(el.childNodes)
      .map(c => formatNode(c, depth + 1))
      .join('');

    return `${indent}${open}\n${children}${indent}${close}\n`;
  }

  // ---------- Lifecycle ----------
  onMount(() => {
    queueMicrotask(() => {
      textareaEl?.focus();
      textareaEl?.select();
    });

    if (previewCanvas) {
      updatePreviewSize();
      previewObserver = new ResizeObserver(updatePreviewSize);
      previewObserver.observe(previewCanvas);
    }
  });

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    previewObserver?.disconnect();
  });
</script>

<div class="modal-backdrop" onclick={handleClose} role="presentation">
  <div
    class="modal html-modal"
    onclick={(e) => e.stopPropagation()}
    role="presentation"
  >
    <header class="modal-header">
      <h3>
        <Code size={14} strokeWidth={1.75} />
        {t('htmlEditor.title')}
      </h3>
      <div class="header-actions">
        <button class="ghost" onclick={format} title={t('htmlEditor.format')}>
          <Wand2 size={14} strokeWidth={1.75} />
          {t('htmlEditor.format')}
        </button>
        <button class="ghost" onclick={reset} title={t('common.reset')}>
          <RotateCcw size={14} strokeWidth={1.75} />
          {t('common.reset')}
        </button>
        <button
          class="ghost"
          onclick={resetSplit}
          title={t('htmlEditor.resetSplit')}
        >
          <Columns2 size={14} strokeWidth={1.75} />
        </button>
        <button class="ghost" onclick={handleClose} title={t('common.close')}>
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
    </header>

    <div class="modal-body">
      {#if error}
        <div class="error-banner" role="alert">
          ⚠️ {error}
        </div>
      {/if}

      <div
        class="split"
        class:resizing
        bind:this={splitContainer}
        style="grid-template-columns: {splitRatio}% 6px 1fr;"
      >
        <div class="pane editor-pane">
          <div class="pane-label">
            <Code size={11} strokeWidth={1.75} />
            {t('htmlEditor.code')}
          </div>
          <!-- svelte-ignore a11y_autofocus -->
          <textarea
            bind:this={textareaEl}
            bind:value={source}
            oninput={onInput}
            onkeydown={onKeyDown}
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
          ></textarea>
        </div>

        <div
          class="splitter"
          onpointerdown={onSplitterDown}
          onpointermove={onSplitterMove}
          onpointerup={onSplitterUp}
          onpointercancel={onSplitterUp}
          role="separator"
          aria-orientation="vertical"
          title={t('htmlEditor.dragToResize')}
        >
          <div class="splitter-handle"></div>
        </div>

        <div class="pane preview-pane">
          <div class="pane-label">
            <Eye size={11} strokeWidth={1.75} />
            {t('htmlEditor.preview')}
            <span class="zoom-badge">{Math.round(previewScale * 100)}%</span>
          </div>
          <div class="preview-canvas" bind:this={previewCanvas}>
            <div
              class="preview-stage"
              style="width: {previewW}px; height: {previewH}px;"
            >
              <div
                class="preview-frame"
                style="transform: scale({previewScale});"
              >
                {@html source}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer class="modal-footer">
      <span class="hint">
        {dirty ? `● ${t('htmlEditor.unsaved')}` : `✓ ${t('htmlEditor.inSync')}`}
        · {t('htmlEditor.hint')}
      </span>
      <button class="primary" onclick={() => { applyNow(); handleClose(); }}>
        {t('common.apply')}
      </button>
    </footer>
  </div>
</div>

<style>
  .html-modal {
    width: min(95vw, 1200px);
    height: min(85vh, 800px);
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
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
  }
  .modal-header h3 :global(svg) {
    color: var(--accent-primary);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .header-actions button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .modal-body {
    flex: 1;
    min-height: 0;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .error-banner {
    padding: 8px 12px;
    background: rgba(248, 113, 113, 0.1);
    border: 1px solid rgba(248, 113, 113, 0.3);
    border-radius: var(--radius-md);
    color: var(--danger);
    font-size: 12px;
    font-family: var(--font-mono);
    word-break: break-word;
  }

  /* ---------- Split ---------- */
  .split {
    flex: 1;
    display: grid;
    min-height: 0;
  }

  .split.resizing {
    user-select: none;
    cursor: col-resize;
  }

  .pane {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }

  .editor-pane { padding-right: 6px; }
  .preview-pane { padding-left: 6px; }

  .pane-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }
  .pane-label :global(svg) {
    color: var(--accent-primary);
  }

  .zoom-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    background: var(--bg-tertiary);
    padding: 1px 6px;
    border-radius: 999px;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
  }

  textarea {
    flex: 1;
    min-height: 0;
    resize: none;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.6;
    padding: 10px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    tab-size: 2;
    white-space: pre;
    overflow: auto;
  }
  textarea:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--accent-dim);
  }

  /* ---------- Splitter ---------- */
  .splitter {
    position: relative;
    width: 6px;
    cursor: col-resize;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
  }

  .splitter::before {
    content: '';
    position: absolute;
    inset: 0 2px;
    background: var(--border-subtle);
    border-radius: 2px;
    transition: background var(--transition-fast);
  }

  .splitter:hover::before,
  .split.resizing .splitter::before {
    background: var(--accent-primary);
  }

  .splitter-handle {
    position: relative;
    z-index: 1;
    width: 4px;
    height: 32px;
    background: transparent;
    border-radius: 2px;
    transition: background var(--transition-fast);
  }

  .splitter:hover .splitter-handle,
  .split.resizing .splitter-handle {
    background: var(--accent-primary);
  }

  /* ---------- Preview ---------- */
  .preview-canvas {
    flex: 1;
    min-height: 0;
    min-width: 0;
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    overflow: auto;
    padding: 8px;
    display: block;
  }

  .preview-stage {
    margin: auto;
    position: relative;
    flex-shrink: 0;
  }

  .preview-frame {
    width: 1280px;
    height: 720px;
    border-radius: var(--radius-md);
    position: relative;
    overflow: hidden;
    box-shadow: var(--shadow-md);
    transform-origin: top left;
  }

  /* Стили превью: копируют Viewport, чтобы элементы отображались корректно */
  .preview-frame :global(.slide-element) {
    position: absolute;
  }

  .preview-frame :global(.slide-inner) {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .preview-frame :global(.element-backdrop) {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .preview-frame :global(.element-content svg) {
    filter: var(--element-filter, none);
  }

  .preview-frame :global(.element-content) {
    position: relative;
    width: 100%;
    height: 100%;
    z-index: 1;
    overflow: visible;
  }

  .preview-frame :global(.el) {
    position: absolute;
  }
  .preview-frame :global(.el-text) {
    padding: 6px 10px;
    color: var(--text-primary);
    word-break: break-word;
    white-space: pre-wrap;
  }
  .preview-frame :global(.el img),
  .preview-frame :global(.el video) {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  .preview-frame :global(.el audio) {
    width: 100%;
    margin-top: 8px;
  }
  .preview-frame :global(.media-wrapper) {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .preview-frame :global(.media-wrapper > img),
  .preview-frame :global(.media-wrapper > video),
  .preview-frame :global(.media-wrapper > svg) {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    display: block;
    filter: var(--element-filter, none);
    border-radius: var(--element-radius, 0);
    clip-path: var(--element-clip-path, none);
  }

  /* ---------- Footer ---------- */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .hint {
    font-family: var(--font-mono);
  }
</style>
