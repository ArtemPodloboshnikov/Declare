<script lang="ts">
  import { t } from '$lib/i18n';
  import { splitElementStyles } from '$lib/services/element-effects';
  import { isMasked, getShapePath } from '$lib/services/shapes';
  import { backgroundToStyle } from '$lib/services/slide-backgrounds';
  import { presentation, type SlideElement, type Slide } from '$lib/stores/presentation.svelte';
  import { Plus } from '@lucide/svelte';
  import ShapeView from './ShapeView.svelte';
  import { parseEmbedUrl } from '$lib/services/video-embed';
  import { DEFAULT_VIDEO_SETTINGS } from '$lib/stores/presentation.svelte';

  // Индекс слайда, над которым сейчас находится перетаскиваемый элемент.
  let dragOverIndex = $state<number | null>(null);
  let draggingIndex = $state<number | null>(null);
  let renamingId = $state<string | null>(null);
  let renameValue = $state('');

  const THUMB_SCALE = 1 / 6.4;

  function selectSlide(index: number) {
    presentation.currentSlideIndex = index;
  }

  function addSlide() {
    presentation.addSlide();
    presentation.currentSlideIndex = presentation.slides.length - 1;
  }

  function duplicateSlide(index: number, e: MouseEvent) {
    e.stopPropagation();
    presentation.duplicateSlide(index);
    presentation.currentSlideIndex = index + 1;
  }

  function deleteSlide(index: number, e: MouseEvent) {
    e.stopPropagation();
    presentation.removeSlide(index);
    const next = Math.min(index, presentation.slides.length - 1);
    presentation.currentSlideIndex = next;
  }

  function moveSlide(from: number, to: number) {
    if (from === to) return;
    presentation.moveSlide(from, to);
    presentation.currentSlideIndex = to;
  }

  // ---------- HTML5 drag-n-drop ----------
  function onDragStart(index: number, e: DragEvent) {
    draggingIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  }

  function onDragOver(index: number, e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dragOverIndex = index;
  }

  function onDragLeave(index: number) {
    if (dragOverIndex === index) dragOverIndex = null;
  }

  function onDrop(index: number, e: DragEvent) {
    e.preventDefault();
    if (draggingIndex === null) return;
    moveSlide(draggingIndex, index);
    draggingIndex = null;
    dragOverIndex = null;
  }

  function onDragEnd() {
    draggingIndex = null;
    dragOverIndex = null;
  }

  // ---------- Переименование ----------
  function startRename(id: string, currentTitle: string, e: MouseEvent) {
    e.stopPropagation();
    renamingId = id;
    renameValue = currentTitle;
  }

  function commitRename() {
    if (!renamingId) return;
    const slide = presentation.slides.find(s => s.id === renamingId);
    if (slide) slide.title = renameValue.trim() || slide.title;
    renamingId = null;
  }

  function onRenameKey(e: KeyboardEvent) {
    if (e.key === 'Enter') commitRename();
    else if (e.key === 'Escape') renamingId = null;
  }

  // ---------- Стили элемента в миниатюре ----------
  function thumbStyles(el: SlideElement) {
    return splitElementStyles(el, {
      scale: THUMB_SCALE,
      skipBackdrop: true, // в миниатюре backdrop-blur не нужен — дорого и незаметно
      disableSquircle: true // squircle в миниатюре не читается
    });
  }

  // ---------- Маска для картинки ----------
  function findMaskShapeFor(targetId: string, slide: Slide): SlideElement | null {
    for (const el of slide.elements) {
      if (el.type === 'shape' && el.shape?.maskTargetId === targetId) {
        return el;
      }
    }
    return null;
  }

  // ---------- Позиция элемента в миниатюре ----------
  function thumbPosition(el: SlideElement): string {
    const x = el.position.x * THUMB_SCALE;
    const y = el.position.y * THUMB_SCALE;
    const w = el.position.width * THUMB_SCALE;
    const h = el.position.height * THUMB_SCALE;
    return `left:${x}px; top:${y}px; width:${w}px; height:${h}px;`;
  }

  // ---------- Заголовок для embed-видео ----------
  function embedInfo(el: SlideElement) {
    const settings = { ...DEFAULT_VIDEO_SETTINGS, ...(el.video ?? {}) };
    if (settings.sourceType !== 'embed' || !settings.embedUrl) return null;
    return parseEmbedUrl(settings.embedUrl);
  }
</script>

<div class="slides-panel">
  <header class="panel-header">
    <h3>{t('slides.title')}</h3>
    <span class="count">{presentation.slides.length}</span>
  </header>

  <div class="slides-list" role="list">
    {#each presentation.slides as slide, i (slide.id)}
      <div
        class="slide-item"
        class:active={presentation.currentSlideIndex === i}
        class:dragging={draggingIndex === i}
        class:drag-over={dragOverIndex === i && draggingIndex !== i}
        draggable="true"
        role="listitem"
        tabindex="0"
        onclick={() => selectSlide(i)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectSlide(i);
          }
        }}
        ondragstart={(e) => onDragStart(i, e)}
        ondragover={(e) => onDragOver(i, e)}
        ondragleave={() => onDragLeave(i)}
        ondrop={(e) => onDrop(i, e)}
        ondragend={onDragEnd}
      >
        <div class="slide-number">{i + 1}</div>

        <div class="slide-thumb" style={backgroundToStyle(slide.background)}>
          <div class="thumb-canvas">
            {#each slide.elements as el (el.id)}
              {#if !(el.style as any)?.hidden}
                {#if !isMasked(el.id, slide)}
                  {@const styles = thumbStyles(el)}
                  {@const maskedShape = el.type === 'image' ? findMaskShapeFor(el.id, slide) : null}

                  <div
                    class="thumb-el thumb-el-{el.type}"
                    style="{thumbPosition(el)} {styles.container};"
                  >
                    <div class="thumb-backdrop" style="{styles.backdrop};"></div>
                    <div class="thumb-content" style="{styles.content};">
                      {#if el.type === 'text'}
                        <span class="thumb-text" style="font-size: {parseFloat(el.style.fontSize ?? '24px') * THUMB_SCALE}px;">
                          {@html el.content}
                        </span>

                      {:else if el.type === 'image'}
                        {#if maskedShape}
                          {@const maskPath = maskedShape.shape?.customPath ?? getShapePath(maskedShape.shape?.kind ?? 'rect')}
                          {@const dx = maskedShape.position.x - el.position.x}
                          {@const dy = maskedShape.position.y - el.position.y}
                          {@const sx = maskedShape.position.width / 100}
                          {@const sy = maskedShape.position.height / 100}
                          <svg
                            class="thumb-mask-svg"
                            width="0"
                            height="0"
                            style="position:absolute"
                            aria-hidden="true"
                          >
                            <defs>
                              <mask id="thumb-mask-{maskedShape.id}" maskUnits="userSpaceOnUse">
                                <rect
                                  x="0"
                                  y="0"
                                  width={el.position.width}
                                  height={el.position.height}
                                  fill="black"
                                />
                                <g transform="translate({dx}, {dy})">
                                  <g transform="scale({sx}, {sy})">
                                    <path d={maskPath} fill="white" />
                                  </g>
                                </g>
                              </mask>
                            </defs>
                          </svg>
                          <img
                            src={el.content}
                            alt=""
                            style="mask-image:url(#thumb-mask-{maskedShape.id}); -webkit-mask-image:url(#thumb-mask-{maskedShape.id});"
                          />
                        {:else}
                          <img src={el.content} alt="" />
                        {/if}

                      {:else if el.type === 'audio'}
                        <span class="thumb-icon">🎵</span>

                      {:else if el.type === 'video'}
                        {#if el.video?.sourceType === 'embed' && el.video.embedUrl}
                          {@const info = embedInfo(el)}
                          <div class="thumb-video-placeholder" data-provider={info?.provider ?? 'custom'}>
                            <span class="thumb-icon">▶</span>
                            <span class="thumb-provider">{info?.provider ?? 'embed'}</span>
                          </div>
                        {:else}
                          <video
                            src={el.content}
                            preload="metadata"
                            muted
                            playsinline
                            style="width:100%; height:100%; object-fit:contain;"
                          ></video>
                        {/if}

                      {:else if el.type === 'chart'}
                        <span class="thumb-icon">📊</span>

                      {:else if el.type === 'table'}
                        <span class="thumb-icon">📋</span>

                      {:else if el.type === 'shape'}
                        <ShapeView
                          element={el}
                          slide={slide}
                          vectorEffect="non-scaling-stroke"
                        />
                      {/if}
                    </div>
                  </div>
                {/if}
              {/if}
            {/each}
          </div>
        </div>

        <div class="slide-meta">
          {#if renamingId === slide.id}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="rename-input"
              type="text"
              bind:value={renameValue}
              onblur={commitRename}
              onkeydown={onRenameKey}
              onclick={(e) => e.stopPropagation()}
              autofocus
            />
          {:else}
            <span
              class="slide-title"
              ondblclick={(e) => startRename(slide.id, slide.title, e)}
              title={slide.title}
            >{slide.title}</span>
          {/if}
        </div>

        <div class="slide-actions">
          <button
            class="icon-btn"
            onclick={(e) => duplicateSlide(i, e)}
            title={t('actions.duplicateSlide') ?? 'Duplicate'}
          >⧉</button>
          <button
            class="icon-btn danger"
            onclick={(e) => deleteSlide(i, e)}
            title={t('actions.deleteSlide') ?? 'Delete'}
          >✕</button>
        </div>
      </div>
    {/each}
    <div class="add-row">
      <button
        class="add-circle"
        onclick={addSlide}
        aria-label={t('actions.newSlide')}
      >
        <Plus strokeWidth={6} />
      </button>
    </div>
  </div>
</div>

<style>
  .slides-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .panel-header h3 {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .count {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-tertiary);
    padding: 2px 8px;
    border-radius: 999px;
    font-variant-numeric: tabular-nums;
  }

  /* ---------- Список ---------- */
  .slides-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .slide-item {
    display: grid;
    grid-template-columns: 22px 1fr;
    grid-template-rows: auto auto;
    grid-template-areas:
      "num thumb"
      "num meta";
    gap: 4px 8px;
    padding: 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    position: relative;
    transition:
      border-color var(--transition-fast),
      background var(--transition-fast),
      transform var(--transition-fast);
  }

  .slide-item:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
  }

  .slide-item.active {
    border-color: var(--accent-primary);
    background: var(--accent-dim);
    box-shadow: 0 0 0 1px var(--accent-primary);
  }

  .slide-item.dragging {
    opacity: 0.4;
    cursor: grabbing;
  }

  .slide-item.drag-over {
    border-color: var(--accent-hover);
    border-style: dashed;
  }

  .slide-number {
    grid-area: num;
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    padding-top: 4px;
    text-align: center;
  }

  .slide-item.active .slide-number {
    color: var(--accent-primary);
    font-weight: 600;
  }

  /* ---------- Миниатюра ---------- */
  .slide-thumb {
    grid-area: thumb;
    aspect-ratio: 16 / 9;
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    overflow: hidden;
    position: relative;
  }

  .thumb-canvas {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .thumb-el {
    position: absolute;
    overflow: hidden;
    font-size: 4px;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: inherit;
  }

  .thumb-el img,
  .thumb-el video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .thumb-el svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  .thumb-content {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .thumb-backdrop {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .thumb-text {
    display: block;
    width: 100%;
    line-height: 1.2;
    padding: 2px;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .thumb-icon {
    font-size: 14px;
    line-height: 1;
    opacity: 0.7;
  }

  .thumb-video-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: #1a1a22;
    color: #fff;
  }

  .thumb-video-placeholder[data-provider="rutube"] { background: #1a1f1a; }
  .thumb-video-placeholder[data-provider="vk"] { background: #1a1a2e; }
  .thumb-video-placeholder[data-provider="youtube"] { background: #1a1a22; }

  .thumb-provider {
    font-size: 5px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.7;
  }

  /* ---------- Метаданные ---------- */
  .slide-meta {
    grid-area: meta;
    display: flex;
    align-items: center;
    min-width: 0;
    height: 18px;
  }

  .slide-title {
    font-size: 11px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    padding: 0 2px;
    cursor: text;
  }

  .slide-item.active .slide-title {
    color: var(--text-primary);
  }

  .rename-input {
    font-size: 11px;
    padding: 2px 4px;
    height: 18px;
    background: var(--bg-elevated);
  }

  /* ---------- Действия ---------- */
  .slide-actions {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .slide-item:hover .slide-actions,
  .slide-item.active .slide-actions {
    opacity: 1;
  }

  .icon-btn {
    width: 22px;
    height: 22px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
  }

  .icon-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .icon-btn.danger:hover {
    border-color: var(--danger);
    color: var(--danger);
    background: rgba(248, 113, 113, 0.1);
  }

  .add-row {
    display: flex;
    justify-content: center;
    padding: 8px 0 4px;
  }

  .add-circle {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 25px;
    font-weight: 400;
    border-radius: 50%;
    background: var(--bg-tertiary);
    border: 1px dashed var(--border-strong);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast),
      transform var(--transition-fast);
  }

  .add-circle:hover {
    background: var(--accent-dim);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    transform: scale(1.05);
  }

  .add-circle:active {
    transform: scale(0.95);
  }
</style>
