<script lang="ts">
  import { t } from '$lib/i18n';
  import { presentation, type SlideElement } from '$lib/stores/presentation.svelte';
  import Type from '@lucide/svelte/icons/type';
  import Image from '@lucide/svelte/icons/image';
  import Music from '@lucide/svelte/icons/music';
  import Video from '@lucide/svelte/icons/video';
  import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
  import Table2 from '@lucide/svelte/icons/table-2';
  import Shapes from '@lucide/svelte/icons/shapes';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Lock from '@lucide/svelte/icons/lock';
  import Unlock from '@lucide/svelte/icons/unlock';
  import GripVertical from '@lucide/svelte/icons/grip-vertical';
  import Layers from '@lucide/svelte/icons/layers';

  const ICONS = {
    text: Type,
    image: Image,
    audio: Music,
    video: Video,
    chart: BarChart3,
    table: Table2,
    shape: Shapes
  } as const;

  let draggingId = $state<string | null>(null);
  let dragOverIndex = $state<number | null>(null);

  // Слои в обратном порядке: верхний элемент массива — самый верхний визуально
  const layers = $derived.by(() => {
    const slide = presentation.currentSlide;
    if (!slide) return [];
    return [...slide.elements].reverse();
  });

  // Реальный индекс в slide.elements (0 = самый нижний)
  function realIndex(layerIndex: number): number {
    const slide = presentation.currentSlide;
    if (!slide) return 0;
    return slide.elements.length - 1 - layerIndex;
  }

  function labelFor(el: SlideElement, index: number): string {
    if (el.type === 'text') {
      const text = el.content.replace(/<[^>]*>/g, '').trim();
      return text.slice(0, 30) || `Text ${index + 1}`;
    }
    if (el.type === 'shape') {
      return t(`shapes.${el.shape?.kind ?? 'rect'}`);
    }
    return t(`elementType.${el.type}`);
  }

  function selectLayer(id: string, e: MouseEvent) {
    e.stopPropagation();
    presentation.selectElement(id, e.shiftKey);
  }

  function toggleVisibility(id: string, e: MouseEvent) {
    e.stopPropagation();
    const slide = presentation.currentSlide;
    if (!slide) return;
    const el = slide.elements.find(x => x.id === id);
    if (!el) return;
    // храним в style.hidden — не влияет на остальную логику
    const hidden = !(el.style as any)?.hidden;
    presentation.updateElement(id, {
      style: { ...el.style, hidden } as any
    });
  }

  function toggleLock(id: string, e: MouseEvent) {
    e.stopPropagation();
    const slide = presentation.currentSlide;
    if (!slide) return;
    const el = slide.elements.find(x => x.id === id);
    if (!el) return;
    const locked = !(el.style as any)?.locked;
    presentation.updateElement(id, {
      style: { ...el.style, locked } as any
    });
  }

  function isHidden(el: SlideElement): boolean {
    return Boolean((el.style as any)?.hidden);
  }

  function isLocked(el: SlideElement): boolean {
    return Boolean((el.style as any)?.locked);
  }

  // ---------- Drag-n-drop ----------
  function onDragStart(id: string, e: DragEvent) {
    draggingId = id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
  }

  function onDragOver(layerIndex: number, e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dragOverIndex = layerIndex;
  }

  function onDragLeave(layerIndex: number) {
    if (dragOverIndex === layerIndex) dragOverIndex = null;
  }

  function onDrop(layerIndex: number, e: DragEvent) {
    e.preventDefault();
    if (!draggingId) return;

    const slide = presentation.currentSlide;
    if (!slide) return;

    const fromReal = slide.elements.findIndex(el => el.id === draggingId);
    if (fromReal < 0) return;

    // Преобразуем индекс слоя (сверху) в реальный индекс (снизу)
    const toReal = realIndex(layerIndex);

    presentation.moveElement(draggingId, toReal);

    draggingId = null;
    dragOverIndex = null;
  }

  function onDragEnd() {
    draggingId = null;
    dragOverIndex = null;
  }
</script>

<div class="layers-panel">
  <header class="panel-subheader">
    <Layers size={14} strokeWidth={1.75} />
    <span>{t('layers.title')}</span>
    <span class="count">{layers.length}</span>
  </header>

  {#if !layers.length}
    <p class="empty">{t('layers.empty')}</p>
  {:else}
    <div class="layers-list" role="list">
      {#each layers as el, layerIndex (el.id)}
        <div
          class="layer-item"
          class:selected={presentation.selectedElementIds.includes(el.id)}
          class:dragging={draggingId === el.id}
          class:drag-over={dragOverIndex === layerIndex && draggingId !== el.id}
          class:hidden={isHidden(el)}
          draggable="true"
          role="listitem"
          tabindex="0"
          onclick={(e) => selectLayer(el.id, e)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              presentation.selectElement(el.id);
            }
          }}
          ondragstart={(e) => onDragStart(el.id, e)}
          ondragover={(e) => onDragOver(layerIndex, e)}
          ondragleave={() => onDragLeave(layerIndex)}
          ondrop={(e) => onDrop(layerIndex, e)}
          ondragend={onDragEnd}
        >
          <span class="drag-handle" aria-hidden="true">
            <GripVertical size={12} strokeWidth={1.75} />
          </span>

          <span class="layer-icon">
            <svelte:component this={ICONS[el.type]} size={12} strokeWidth={1.75} />
          </span>

          <span class="layer-label" title={labelFor(el, layerIndex)}>
            {labelFor(el, layerIndex)}
          </span>

          <button
            type="button"
            class="icon-btn"
            class:active={isHidden(el)}
            onclick={(e) => toggleVisibility(el.id, e)}
            title={isHidden(el) ? t('layers.show') : t('layers.hide')}
            aria-label={isHidden(el) ? t('layers.show') : t('layers.hide')}
          >
            {#if isHidden(el)}
              <EyeOff size={12} strokeWidth={1.75} />
            {:else}
              <Eye size={12} strokeWidth={1.75} />
            {/if}
          </button>

          <button
            type="button"
            class="icon-btn"
            class:active={isLocked(el)}
            onclick={(e) => toggleLock(el.id, e)}
            title={isLocked(el) ? t('layers.unlock') : t('layers.lock')}
            aria-label={isLocked(el) ? t('layers.unlock') : t('layers.lock')}
          >
            {#if isLocked(el)}
              <Lock size={12} strokeWidth={1.75} />
            {:else}
              <Unlock size={12} strokeWidth={1.75} />
            {/if}
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .layers-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .count {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-muted);
    background: var(--bg-tertiary);
    padding: 1px 6px;
    border-radius: 999px;
  }

  .empty {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    margin: 0;
  }

  .layers-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 320px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .layer-item {
    display: grid;
    grid-template-columns: 16px 18px 1fr 22px 22px;
    align-items: center;
    gap: 6px;
    padding: 5px 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    user-select: none;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      opacity var(--transition-fast);
  }

  .layer-item:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
  }

  .layer-item.selected {
    background: var(--accent-dim);
    border-color: var(--accent-primary);
  }

  .layer-item.hidden {
    opacity: 0.5;
  }

  .layer-item.dragging {
    opacity: 0.35;
  }

  .layer-item.drag-over {
    border-top: 2px solid var(--accent-primary);
    margin-top: -1px;
  }

  .drag-handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    cursor: grab;
  }
  .layer-item:active .drag-handle {
    cursor: grabbing;
  }

  .layer-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }
  .layer-item.selected .layer-icon {
    color: var(--accent-primary);
  }

  .layer-label {
    font-size: 12px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .icon-btn {
    width: 22px;
    height: 22px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    transition: color var(--transition-fast), background var(--transition-fast);
  }
  .icon-btn:hover {
    color: var(--text-primary);
    background: var(--bg-secondary);
  }
  .icon-btn.active {
    color: var(--accent-primary);
  }
</style>
