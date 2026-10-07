<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import { presentation, type SlideElement } from '$lib/stores/presentation.svelte';
  import ChartView from './ChartView.svelte';
  import TableView from './TableView.svelte';
  import EditableText from './EditableText.svelte';
  import AudioPlayer from './AudioPlayer.svelte';
  import EmbedPlayer from './EmbedPlayer.svelte';
  import VideoPlayer from './VideoPlayer.svelte';
  import { app, CANVAS_H, CANVAS_W } from '$lib/stores/app.svelte';
  import { detectDropKind, parseCsv, readTextFile, readXlsx, type DropKind } from '$lib/services/file-import';
  import ShapeView from './ShapeView.svelte';
  import ShapeEditor from './ShapeEditor.svelte';
  import SvgMasksDefs from './SvgMasksDefs.svelte';
  import { isMasked } from '$lib/services/shapes';
  import { backgroundToStyle } from '$lib/services/slide-backgrounds';
  import { splitElementStyles } from '$lib/services/element-effects';
  import MediaView from './MediaView.svelte';
  import { Clapperboard, Plus, RotateCcw, Trash } from '@lucide/svelte';
  import { animationClass, animationStyle } from '$lib/services/animations';
  import { escapeHtml } from '$lib/services/common';
  import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';

  // Отслеживаем, редактируется ли сейчас текст
  let editingElementId = $state<string | null>(null);
  let containerEl: HTMLDivElement;
  let zoom = $state(1);           // пользовательский зум, 1 = 100%
  let autoScale = $state(1);      // авто-подгонка под контейнер
  let scale = $derived(autoScale * zoom);   // итоговый масштаб канваса
  // Смещение канваса относительно центра viewport (в пикселях экрана)
  let panX = $state(0);
  let panY = $state(0);
  let spaceHeld = $state(false);
  let dropActive = $state(false);
  const CLIPBOARD_PREFIX = 'DECLARE_ELEMENTS:';
  let internalClipboard: SlideElement[] = [];

  async function copySelected() {
    const slide = presentation.currentSlide;
    if (!slide) return;

    const selected = slide.elements.filter(e =>
      presentation.selectedElementIds.includes(e.id)
    );
    if (!selected.length) return;

    // Снимаем Proxy через $state.snapshot
    const clones = selected.map(el => {
      const clone = $state.snapshot(el) as SlideElement;
      const { id, ...rest } = clone;
      return rest as SlideElement;
    });

    internalClipboard = clones;

    try {
      const payload = CLIPBOARD_PREFIX + JSON.stringify(clones);
      await writeText(payload);
    } catch {}
  }

  async function cutSelected() {
    const slide = presentation.currentSlide;
    if (!slide) return;

    const ids = presentation.selectedElementIds;
    if (!ids.length) return;

    await copySelected();

    presentation.removeElements(ids);
    presentation.selectedElementIds = [];
  }

  async function pasteFromClipboard() {
    const slide = presentation.currentSlide;
    if (!slide) return;

    let source: SlideElement[] | null = null;

    // 1. Пытаемся прочитать системный буфер
    try {
      const text = await readText();
      if (text && text.startsWith(CLIPBOARD_PREFIX)) {
        const json = text.slice(CLIPBOARD_PREFIX.length);
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed) && parsed.length) {
          source = parsed as SlideElement[];
        }
      }
    } catch {}

    // 2. Фолбэк на внутренний буфер
    if (!source && internalClipboard.length) {
      source = internalClipboard;
    }

    if (!source || !source.length) return;

    const OFFSET = 20;

    const newIds: string[] = [];
    const newElements: SlideElement[] = source.map(el => {
      const id = crypto.randomUUID();
      newIds.push(id);
      return {
        ...structuredClone(el),
        id,
        position: {
          ...el.position,
          x: el.position.x + OFFSET,
          y: el.position.y + OFFSET
        }
      };
    });

    presentation.addElements(newElements);
    presentation.selectedElementIds = newIds;

    // Обновляем внутренний буфер — следующий Ctrl+V сдвинет ещё дальше
    internalClipboard = newElements.map(el => {
      const clone = structuredClone(el) as SlideElement;
      delete (clone as any).id;
      return clone;
    });
  }

  async function duplicateSelected() {
    await copySelected();
    await pasteFromClipboard();
  }

  // Состояние активного панорамирования
  let panning = $state<{
    pointerId: number;
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
  } | null>(null);

  let dragging = $state<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    visualOffsetX: number;
    visualOffsetY: number;
    visualWidth: number;
    visualHeight: number;
    shiftHeld: boolean;
  } | null>(null);

  let resizing = $state<{
    id: string;
    corner: 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    aspectRatio: number;
  } | null>(null);

  let rotating = $state<{
    id: string;
    startAngle: number;   // угол от центра элемента до курсора в момент старта (рад)
    origRotation: number; // исходный rotation (град)
    cx: number;           // центр элемента в координатах канваса
    cy: number;
  } | null>(null);

  let snapGuides = $state<{
    x: number | null;
    y: number | null;
  }>({ x: null, y: null });

  const SNAP_THRESHOLD = 8;
  const NUDGE_STEP = 1;        // px за одно нажатие
  const NUDGE_STEP_FAST = 10;  // px с Shift
  type SnapBest = { value: number; guide: number; dist: number };

  /**
   * Возвращает ближайшую snap-координату для оси X (left/right/center).
   * Возвращает { value, snapped } — новое значение X, и было ли выравнивание.
   */
  function snapX(
    proposedX: number,
    visualOffsetX: number,
    visualWidth: number,
    excludeId: string
  ): { value: number; guide: number | null } {
    const slide = presentation.currentSlide;
    if (!slide) return { value: proposedX, guide: null };

    const visLeft = proposedX + visualOffsetX;
    const visRight = visLeft + visualWidth;
    const visCenter = visLeft + visualWidth / 2;

    const tryGuide = (
      current: SnapBest | null,
      guide: number,
      myEdge: number
    ): SnapBest | null => {
      const dist = Math.abs(myEdge - guide);
      if (dist > SNAP_THRESHOLD) return current;
      if (current && dist >= current.dist) return current;
      const dx = guide - myEdge;
      return { value: proposedX + dx, guide, dist };
    };

    let best: SnapBest | null = null;

    best = tryGuide(best, 0, visLeft);
    best = tryGuide(best, CANVAS_W, visRight);

    for (const other of slide.elements) {
      if (other.id === excludeId) continue;
      const oLeft = other.position.x;
      const oRight = other.position.x + other.position.width;
      const oCenterX = other.position.x + other.position.width / 2;

      best = tryGuide(best, oLeft, visLeft);
      best = tryGuide(best, oRight, visLeft);
      best = tryGuide(best, oCenterX, visLeft);

      best = tryGuide(best, oLeft, visRight);
      best = tryGuide(best, oRight, visRight);
      best = tryGuide(best, oCenterX, visRight);

      best = tryGuide(best, oLeft, visCenter);
      best = tryGuide(best, oRight, visCenter);
      best = tryGuide(best, oCenterX, visCenter);
    }

    if (best) {
      return { value: Math.round(best.value), guide: best.guide };
    }
    return { value: proposedX, guide: null };
  }

  function snapY(
    proposedY: number,
    visualOffsetY: number,
    visualHeight: number,
    excludeId: string
  ): { value: number; guide: number | null } {
    const slide = presentation.currentSlide;
    if (!slide) return { value: proposedY, guide: null };

    const visTop = proposedY + visualOffsetY;
    const visBottom = visTop + visualHeight;
    const visCenter = visTop + visualHeight / 2;

    const tryGuide = (
      current: SnapBest | null,
      guide: number,
      myEdge: number
    ): SnapBest | null => {
      const dist = Math.abs(myEdge - guide);
      if (dist > SNAP_THRESHOLD) return current;
      if (current && dist >= current.dist) return current;
      const dy = guide - myEdge;
      return { value: proposedY + dy, guide, dist };
    };

    let best: SnapBest | null = null;

    best = tryGuide(best, 0, visTop);
    best = tryGuide(best, CANVAS_H, visBottom);

    for (const other of slide.elements) {
      if (other.id === excludeId) continue;
      const oTop = other.position.y;
      const oBottom = other.position.y + other.position.height;
      const oCenterY = other.position.y + other.position.height / 2;

      best = tryGuide(best, oTop, visTop);
      best = tryGuide(best, oBottom, visTop);
      best = tryGuide(best, oCenterY, visTop);

      best = tryGuide(best, oTop, visBottom);
      best = tryGuide(best, oBottom, visBottom);
      best = tryGuide(best, oCenterY, visBottom);

      best = tryGuide(best, oTop, visCenter);
      best = tryGuide(best, oBottom, visCenter);
      best = tryGuide(best, oCenterY, visCenter);
    }

    if (best) {
      return { value: Math.round(best.value), guide: best.guide };
    }
    return { value: proposedY, guide: null };
  }

  function nudgeSelected(dx: number, dy: number) {
    const id = presentation.selectedElementId;
    if (!id) return;

    const el = findElement(id);
    if (!el) return;

    const nextX = el.position.x + dx;
    const nextY = el.position.y + dy;

    presentation.updateElement(id, {
      position: { ...el.position, x: nextX, y: nextY }
    }, true);
  }

  // Пересчёт масштаба под размер контейнера (16:9 слайд = 1280x720)
  function updateScale() {
    if (!containerEl) return;
    const pad = 48;
    const availW = containerEl.clientWidth - pad;
    const availH = containerEl.clientHeight - pad;
    const sw = 1280;
    const sh = 720;
    autoScale = Math.min(availW / sw, availH / sh, 1);
  }

  function startRotate(id: string, e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const el = findElement(id);
    if (!el) return;

    const cx = el.position.x + el.position.width / 2;
    const cy = el.position.y + el.position.height / 2;

    const canvas = document.querySelector<HTMLElement>('.slide-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / scale;
    const py = (e.clientY - rect.top) / scale;

    const startAngle = Math.atan2(py - cy, px - cx);

    rotating = {
      id,
      startAngle,
      // ВАЖНО: берём угол из transform, а не из position
      origRotation: el.transform?.rotation ?? 0,
      cx,
      cy
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onWheel(e: WheelEvent) {
    // На macOS жест зума приходит как ctrlKey=true автоматически при pinch.
    // На Windows/Linux пользователь зажимает Ctrl вручную.
    if (!e.ctrlKey && !e.metaKey) return;

    e.preventDefault();
    e.stopPropagation();

    // Шаг: 10% за одно деление колеса
    const delta = -e.deltaY;
    const step = 0.1;
    const factor = 1 + Math.sign(delta) * step;

    const next = Math.max(0.1, Math.min(4, zoom * factor));
    zoom = next;
  }

  onMount(() => {
    const suppressAutoscroll = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    document.addEventListener('auxclick', suppressAutoscroll);

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(containerEl);

    return () => {
      document.removeEventListener('auxclick', suppressAutoscroll);
      ro.disconnect();
    };
  });

  function selectElement(id: string, e: MouseEvent) {
    e.stopPropagation();
    presentation.selectElement(id, e.shiftKey);
  }

  /**
   * Возвращает визуальные границы элемента в координатах канваса.
   * Для большинства типов совпадает с el.position, но для image/text
   * может отличаться (картинка не растягивается, текст не занимает всю высоту).
   */
  function getVisualRect(el: SlideElement): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    // Пытаемся найти DOM-элемент и измерить его реальные размеры
    const domEl = document.querySelector<HTMLElement>(`[data-id="${el.id}"]`);
    if (!domEl || !containerEl) {
      // Fallback — считаем, что визуально = блок
      return { ...el.position };
    }

    // Внутренний контент (то, что реально видно)
    const target = findVisualTarget(domEl, el.type);
    if (!target) {
      return { ...el.position };
    }

    const canvasRect = document
      .querySelector<HTMLElement>('.slide-canvas')
      ?.getBoundingClientRect();
    if (!canvasRect) return { ...el.position };

    const targetRect = target.getBoundingClientRect();

    // Переводим координаты экрана в координаты канваса (учитывая scale)
    const x = (targetRect.left - canvasRect.left) / scale;
    const y = (targetRect.top - canvasRect.top) / scale;
    const width = targetRect.width / scale;
    const height = targetRect.height / scale;

    return { x, y, width, height };
  }

  /**
   * Находит DOM-узел, который визуально определяет границы элемента.
   */
  function findVisualTarget(domEl: HTMLElement, type: SlideElement['type']): HTMLElement | null {
    switch (type) {
      case 'image':
        return domEl.querySelector<HTMLElement>('.media-wrapper > img, .media-wrapper > svg');
      case 'text':
        return domEl.querySelector<HTMLElement>('.el-text');
      case 'table':
        return domEl.querySelector<HTMLElement>('.exp-table, table');
      case 'chart':
        // У chart внутри .chart-wrap есть padding:8px — визуально это canvas
        return domEl.querySelector<HTMLElement>('.chart-wrap');
      case 'video':
        return domEl.querySelector<HTMLElement>('.exp-video-player, .media-wrapper > video');
      case 'shape':
        return domEl.querySelector<HTMLElement>('svg.shape-svg');
      default:
        return domEl.querySelector<HTMLElement>('.element-content') ?? domEl;
    }
  }

  function startDrag(id: string, e: PointerEvent) {
    // если элемент сейчас в режиме текстового редактирования — не перетаскиваем
    if (editingElementId === id) return;
    const el = findElement(id);
    if (!el) return;
    // текст не перетаскиваем при одиночном клике — только через "ручку",
    // либо разрешаем drag с любой точки, но не когда идёт выделение текста.
    e.stopPropagation();
    e.preventDefault();
    const vis = getVisualRect(el);

    dragging = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.position.x,
      origY: el.position.y,
      // Насколько визуальный прямоугольник смещён относительно блока
      visualOffsetX: vis.x - el.position.x,
      visualOffsetY: vis.y - el.position.y,
      visualWidth: vis.width,
      visualHeight: vis.height,
      shiftHeld: e.shiftKey
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function startResize(id: string, corner: 'nw' | 'ne' | 'sw' | 'se', e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const el = findElement(id);
    if (!el) return;

    resizing = {
      id,
      corner,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.position.x,
      origY: el.position.y,
      origW: el.position.width,
      origH: el.position.height,
      aspectRatio: el.position.width / el.position.height || 1
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (panning && e.pointerId === panning.pointerId) {
      panX = panning.origPanX + (e.clientX - panning.startX);
      panY = panning.origPanY + (e.clientY - panning.startY);
      return;
    }

    if (dragging) {
      const dx = (e.clientX - dragging.startX) / scale;
      const dy = (e.clientY - dragging.startY) / scale;
      const el = findElement(dragging.id);
      if (!el) return;

      let nextX = dragging.origX + dx;
      let nextY = dragging.origY + dy;

      // ---- Shift: ограничение по оси ----
      const shiftNow = e.shiftKey || dragging.shiftHeld;
      if (shiftNow) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          nextY = dragging.origY;
        } else {
          nextX = dragging.origX;
        }
      }

      // ---- Snap к краям (по ВИЗУАЛЬНЫМ границам) ----
      const xSnap = snapX(
        nextX,
        dragging.visualOffsetX,
        dragging.visualWidth,
        el.id
      );
      const ySnap = snapY(
        nextY,
        dragging.visualOffsetY,
        dragging.visualHeight,
        el.id
      );

      el.position.x = xSnap.value;
      el.position.y = ySnap.value;

      snapGuides = { x: xSnap.guide, y: ySnap.guide };

      return;
    }

    if (resizing) {
      const dx = (e.clientX - resizing.startX) / scale;
      const dy = (e.clientY - resizing.startY) / scale;
      const el = findElement(resizing.id);
      if (!el) return;

      const shift = e.shiftKey;
      const corner = resizing.corner;

      // Направление роста: для правых углов +1, для левых -1
      const dirX = corner === 'ne' || corner === 'se' ? 1 : -1;
      const dirY = corner === 'sw' || corner === 'se' ? 1 : -1;

      let newW = resizing.origW + dx * dirX;
      let newH = resizing.origH + dy * dirY;

      // Минимальные размеры
      const MIN_W = 20;
      const MIN_H = 20;

      if (shift && resizing.aspectRatio > 0) {
        const ratio = resizing.aspectRatio;

        // Определяем доминирующую ось: сравниваем относительное изменение
        const relW = Math.abs(newW / resizing.origW - 1);
        const relH = Math.abs(newH / resizing.origH - 1);

        if (relW >= relH) {
          // Тянем по ширине — высоту считаем от ширины
          newH = newW / ratio;
        } else {
          // Тянем по высоте — ширину считаем от высоты
          newW = newH * ratio;
        }
      }

      newW = Math.max(MIN_W, newW);
      newH = Math.max(MIN_H, newH);

      // Если после ограничения по MIN пропорции сбились — пересчитываем
      if (shift && resizing.aspectRatio > 0) {
        if (newW / newH !== resizing.aspectRatio) {
          // Ограничиваем по той оси, которая сохранит пропорции
          if (newW / resizing.aspectRatio < newH) {
            newH = newW / resizing.aspectRatio;
          } else {
            newW = newH * resizing.aspectRatio;
          }
        }
      }

      // Для левых/верхних углов сдвигаем позицию
      let newX = resizing.origX;
      let newY = resizing.origY;

      if (corner === 'nw' || corner === 'sw') {
        // Правый край зафиксирован: x = origRight - newW
        newX = resizing.origX + resizing.origW - newW;
      }
      if (corner === 'nw' || corner === 'ne') {
        // Нижний край зафиксирован: y = origBottom - newH
        newY = resizing.origY + resizing.origH - newH;
      }

      el.position.x = Math.round(newX);
      el.position.y = Math.round(newY);
      el.position.width = Math.round(newW);
      el.position.height = Math.round(newH);
    }

    if (rotating) {
      const el = findElement(rotating.id);
      if (!el) return;

      const canvas = document.querySelector<HTMLElement>('.slide-canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) / scale;
      const py = (e.clientY - rect.top) / scale;

      const angle = Math.atan2(py - rotating.cy, px - rotating.cx);
      const deltaDeg = (angle - rotating.startAngle) * 180 / Math.PI;

      let next = rotating.origRotation + deltaDeg;

      if (e.shiftKey) {
        next = Math.round(next / 15) * 15; // шаг 15° с Shift
      } else {
        next = Math.round(next);
      }

      // Нормализуем в [-180, 180)
      next = ((next + 180) % 360 + 360) % 360 - 180;

      // ВАЖНО: пишем в transform.rotation, а не в position.rotation
      presentation.updateElement(el.id, {
        transform: { ...(el.transform ?? {}), rotation: next }
      }, true);
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (panning && e.pointerId === panning.pointerId) panning = null;
    dragging = null;
    resizing = null;
    rotating = null;
    snapGuides = { x: null, y: null };
  }

  function findElement(id: string): SlideElement | undefined {
    return presentation.currentSlide?.elements.find(e => e.id === id);
  }

  function deleteSelected() {
    if (presentation.selectedElementId) {
      presentation.removeElement(presentation.selectedElementId);
      presentation.selectedElementId = null;
    }
  }

  /**
   * Подгоняет размер фрейма под видимый контент по одной оси.
   * axis = 'x' → меняет width и, при необходимости, x (чтобы левый край остался).
   * axis = 'y' → меняет height и, при необходимости, y.
   */
  function shrinkToVisual(id: string, axis: 'x' | 'y') {
    const el = findElement(id);
    if (!el) return;

    const vis = getVisualRect(el);
    const offsetX = vis.x - el.position.x;
    const offsetY = vis.y - el.position.y;

    if (axis === 'x') {
      // Сдвигаем левый край к видимому контенту и сжимаем ширину
      const newX = Math.round(el.position.x + offsetX);
      const newW = Math.max(20, Math.round(vis.width));
      el.position.x = newX;
      el.position.width = newW;
    } else {
      const newY = Math.round(el.position.y + offsetY);
      const newH = Math.max(20, Math.round(vis.height));
      el.position.y = newY;
      el.position.height = newH;
    }

    presentation.updateElement(id, {
      position: { ...el.position }
    }, true);
    presentation.commitPendingHistory();
  }

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const inField = target.closest('input, textarea, [contenteditable="true"]');
    // ---------- Модификаторы: Ctrl/Cmd ----------
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !inField) {
      switch (e.code) {
        case 'KeyC':
          e.preventDefault();
          void copySelected();
          return;
        case 'KeyX':
          e.preventDefault();
          cutSelected();
          return;
        case 'KeyD':
          e.preventDefault();
          duplicateSelected();
          return;
      }
    }

    if (e.code === 'Space') {
      spaceHeld = true;
      if (!inField) e.preventDefault();
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const target = e.target as HTMLElement;
      const inField = target.closest('input, textarea, [contenteditable="true"]');
      if (inField) return;

      if (presentation.selectedElementId) {
        e.preventDefault();
        deleteSelected();
      }
      return;
    }

    // ---------- Стрелки: перемещение выбранного элемента ----------
    if (inField) return;

    if (!presentation.selectedElementId) return;

    const step = e.shiftKey ? NUDGE_STEP_FAST : NUDGE_STEP;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        nudgeSelected(-step, 0);
        return;
      case 'ArrowRight':
        e.preventDefault();
        nudgeSelected(step, 0);
        return;
      case 'ArrowUp':
        e.preventDefault();
        nudgeSelected(0, -step);
        return;
      case 'ArrowDown':
        e.preventDefault();
        nudgeSelected(0, step);
        return;
    }

    if (e.key === 'Escape') {
      presentation.selectedElementId = null;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') spaceHeld = false;
  }

  function onViewportPointerDown(e: PointerEvent) {
    const isPan = e.button === 1 || (e.button === 0 && spaceHeld);
    // Только средняя кнопка мыши
    if (!isPan) return;

    e.preventDefault();  // подавляем автоскролл браузера
    e.stopPropagation();

    panning = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origPanX: panX,
      origPanY: panY
    };

    // Захватываем указатель, чтобы события приходили даже за пределами viewport
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onDragOver(e: DragEvent) {
    // Только файлы, не внутренние перетаскивания
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dropActive = true;
  }

  function onDragLeave(e: DragEvent) {
    // Проверяем, что ушли за пределы viewport, а не перешли на дочерний
    if (e.currentTarget === e.target) {
      dropActive = false;
    }
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    dropActive = false;

    const files = Array.from(e.dataTransfer?.files ?? []);
    if (!files.length) return;

    for (const file of files) {
      const kind = detectDropKind(file);
      if (!kind) {
        app.notify(
          t('toast.dropUnsupported', { name: file.name }),
          'error',
          4000
        );
        continue;
      }

      await addDroppedFile(file, kind);
    }
  }

  async function addDroppedFile(file: File, kind: Exclude<DropKind, null>) {
    const slide = presentation.currentSlide;
    if (!slide) {
      app.notify(t('toast.noSlides'), 'error');
      return;
    }

    const baseElement = {
      id: crypto.randomUUID(),
      content: '',
      style: {},
      position: { x: 160, y: 120, width: 480, height: 320 }
    };

    if (kind === 'image') {
      presentation.addElement({
        ...baseElement,
        type: 'image',
        content: URL.createObjectURL(file)
      });
    } else if (kind === 'audio') {
      presentation.addElement({
        ...baseElement,
        type: 'audio',
        content: URL.createObjectURL(file),
        position: { x: 200, y: 320, width: 480, height: 60 }
      });
    } else if (kind === 'video') {
      presentation.addElement({
        ...baseElement,
        type: 'video',
        content: URL.createObjectURL(file),
        position: { x: 200, y: 120, width: 560, height: 340 }
      });
    } else if (kind === 'table') {
      try {
        let parsed: string[][];
        if (file.name.toLowerCase().endsWith('.csv')) {
          const text = await readTextFile(file);
          parsed = parseCsv(text);
        } else {
          parsed = await readXlsx(file);
        }
        if (!parsed.length) {
          app.notify(t('toast.dropEmptyFile', { name: file.name }), 'error');
          return;
        }
        const width = Math.max(...parsed.map(r => r.length));
        const normalized = parsed.map(r => {
          const copy = [...r];
          while (copy.length < width) copy.push('');
          return copy;
        });
        presentation.addElement({
          ...baseElement,
          type: 'table',
          content: JSON.stringify({
            headers: normalized[0],
            rows: normalized.slice(1)
          }),
          position: { x: 160, y: 120, width: 640, height: 320 }
        });
      } catch (err) {
        app.notify(
          t('toast.dropImportFailed', { name: file.name, error: String(err) }),
          'error',
          5000
        );
        return;
      }
    }

    app.notify(t('toast.dropAdded', { name: file.name }), 'success');
  }

  async function onPaste(e: ClipboardEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, [contenteditable="true"]')) {
      return;
    }

    const data = e.clipboardData;
    if (!data) return;

    const files = Array.from(data.files ?? []);
    const text = data.getData('text/plain');

    // ---- 1. Файлы ----
    if (files.length) {
      e.preventDefault();
      for (const file of files) {
        const kind = detectDropKind(file);
        if (!kind) {
          app.notify(t('toast.pasteUnsupported', { name: file.name }), 'error', 4000);
          continue;
        }
        void addDroppedFile(file, kind);
      }
      return;
    }

    // ---- 2. Наши элементы ----
    if (text && text.startsWith(CLIPBOARD_PREFIX)) {
      e.preventDefault();
      await pasteFromClipboard();   // ← вставляем элементы
      return;
    }

    // ---- 3. Обычный текст извне ----
    if (text && text.trim()) {
      e.preventDefault();
      const slide = presentation.currentSlide;
      if (!slide) return;

      const lines = text.split('\n');
      const maxLineLength = Math.max(...lines.map(l => l.length), 10);
      const fontSize = 24;
      const width = Math.min(1120, Math.max(200, Math.round(maxLineLength * fontSize * 0.6)));
      const height = Math.min(600, Math.max(60, Math.round(lines.length * fontSize * 1.5)));

      presentation.addElement({
        id: crypto.randomUUID(),
        type: 'text',
        content: escapeHtml(text).replace(/\n/g, '<br>'),
        style: { color: '#e8e8f0', fontSize: `${fontSize}px` },
        position: { x: 80, y: 80, width, height }
      });
      app.notify(t('toast.pasteText'), 'success');
    }
  }

  function onShapeDblClick(id: string, e: MouseEvent) {
    e.stopPropagation();
    presentation.enterShapeEdit(id);
  }

  function onCanvasClick(e: MouseEvent) {
    if (presentation.editingShapeId) {
      presentation.exitShapeEdit();
      return;
    }
    presentation.selectedElementId = null;
  }

  const canvasStyle = $derived.by(() => {
    const bg = presentation.currentSlide?.background;
    return backgroundToStyle(bg);
  });

  function elementStyles(el: SlideElement) {
    const split = splitElementStyles(el);
    return split;
  }

  $effect(() => {
    // при смене currentSlideIndex — перезапустить анимации для текущего слайда
    const slideEl = document.querySelector<HTMLElement>('.slide-canvas');
    if (!slideEl) return;
    slideEl.classList.remove('slide-active');
    // реflow
    void slideEl.offsetWidth;
    slideEl.classList.add('slide-active');
  });

  onMount(() => {
    const handler = (e: Event) => {
      const { elementId } = (e as CustomEvent).detail;
      if (!elementId) return;

      // Ищем элемент в сторе
      const found = findElement(elementId);
      if (!found?.animation || found.animation.kind === 'none') return;

      // Ищем DOM-элемент
      const domEl = document.querySelector(`[data-id="${elementId}"]`) as HTMLElement | null;
      if (!domEl) return;

      const animCls = animationClass(found.animation);
      if (!animCls) return;
      // Перезапуск анимации через inline-стиль
      domEl.style.animation = 'none';
      void domEl.offsetWidth;
      domEl.style.animation = '';
    };
    window.addEventListener('preview-animation', handler);
    return () => window.removeEventListener('preview-animation', handler);
  });
</script>

<svelte:window
  onkeyup={onKeyUp}
  onkeydown={onKeyDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onwheel={onWheel}
  onpaste={onPaste}
/>

<div
  class="viewport"
  class:drop-active={dropActive}
  bind:this={containerEl}
  onpointerdown={onViewportPointerDown}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
  role="presentation"
>
  {#if presentation.currentSlide}
    <div
      class="slide-canvas"
      style="transform: translate({panX}px, {panY}px) scale({scale}); {canvasStyle}"
      onpointerdown={onViewportPointerDown}
      onclick={onCanvasClick}
      role="presentation"
    >
      <SvgMasksDefs />
      {#if snapGuides.x !== null}
        <div
          class="snap-guide snap-guide-x"
          style="left: {snapGuides.x}px;"
        ></div>
      {/if}
      {#if snapGuides.y !== null}
        <div
          class="snap-guide snap-guide-y"
          style="top: {snapGuides.y}px;"
        ></div>
      {/if}
      {#each presentation.currentSlide.elements as el (el.id)}
          {#if resizing}
            {@const el = findElement(resizing.id)}
            {#if el}
              <div
                class="resize-tooltip"
                style="left: {el.position.x + el.position.width / 2}px; top: {el.position.y - 24}px;"
              >
                {el.position.width} × {el.position.height}
              </div>
            {/if}
          {/if}
        {#if !isMasked(el.id, presentation.currentSlide) && !(el.style as any)?.hidden}
        {@const styles = elementStyles(el)}
        <div
          class="slide-element {animationClass(el.animation)}"
          class:has-inner-shadow={el.effects?.innerShadow?.enabled && el.type !== 'shape'}
          class:selected={presentation.selectedElementIds.includes(el.id)}
          class:editing={presentation.editingShapeId === el.id}
          ondblclick={el.type === 'shape' ? (e) => onShapeDblClick(el.id, e) : undefined}
          data-anim={el.animation && el.animation.kind !== 'none' ? el.animation.kind : undefined}
          data-trigger={el.animation?.trigger}
          data-id={el.id}
          style="
            left: {el.position.x}px;
            top: {el.position.y}px;
            width: {el.position.width}px;
            height: {el.position.height}px;
            {styles.container};
            {animationStyle(el.animation)}
          "
          onpointerdown={(e) => {
            if ((el.style as any)?.locked) return;
            startDrag(el.id, e);
          }}
          onclick={(e) => selectElement(el.id, e)}
          role="presentation"
        >
            {#if presentation.selectedElementIds.includes(el.id)}
              <!-- Полоски для shrink-to-fit по краям фрейма -->
              <div
                class="frame-edge frame-edge-left"
                ondblclick={(e) => { e.stopPropagation(); shrinkToVisual(el.id, 'x'); }}
                role="presentation"
                title={t('viewport.fitWidth')}
              ></div>
              <div
                class="frame-edge frame-edge-right"
                ondblclick={(e) => { e.stopPropagation(); shrinkToVisual(el.id, 'x'); }}
                role="presentation"
                title={t('viewport.fitWidth')}
              ></div>
              <div
                class="frame-edge frame-edge-top"
                ondblclick={(e) => { e.stopPropagation(); shrinkToVisual(el.id, 'y'); }}
                role="presentation"
                title={t('viewport.fitHeight')}
              ></div>
              <div
                class="frame-edge frame-edge-bottom"
                ondblclick={(e) => { e.stopPropagation(); shrinkToVisual(el.id, 'y'); }}
                role="presentation"
                title={t('viewport.fitHeight')}
              ></div>
            {/if}
          <div class="element-backdrop" style="{styles.backdrop}; {el.type === 'shape' && el.effects?.backdropBlur?.enabled ? `-webkit-mask-image: url(#shape-mask-${el.id}); mask-image: url(#shape-mask-${el.id}); -webkit-mask-size: 100% 100%; mask-size: 100% 100%; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;` : ''}"></div>
          <div class="element-content" style="{styles.content};">
            {#if el.type === 'text'}
                <EditableText
                    element={el}
                    onSelect={(id) => (presentation.selectedElementId = id)}
                />
            {:else if el.type === 'image'}
                <div class="media-wrapper">
                    <MediaView element={el} src={el.content} />
                </div>
            {:else if el.type === 'audio'}
                <AudioPlayer element={el} mode="edit" />
            {:else if el.type === 'video'}
                {#if el.video?.sourceType === 'embed' && el.video.embedUrl}
                    <EmbedPlayer element={el} />
                {:else}
                    <VideoPlayer element={el} mode="edit" />
                {/if}
            {:else if el.type === 'chart'}
                <div class="isolate-layer">
                    <ChartView element={el} />
                </div>
            {:else if el.type === 'table'}
                <TableView element={el} />
            {:else if el.type === 'shape'}
                <div class="isolate-layer">
                    <ShapeView element={el} />
                </div>

                {#if presentation.editingShapeId === el.id}
                  <ShapeEditor element={el} />
                {/if}
            {/if}
            </div>

            {#if presentation.selectedElementId === el.id}
              <!-- Угловые ручки ресайза -->
              <div
                class="resize-handle nw"
                onpointerdown={(e) => startResize(el.id, 'nw', e)}
                role="presentation"
              ></div>
              <div
                class="resize-handle ne"
                onpointerdown={(e) => startResize(el.id, 'ne', e)}
                role="presentation"
              ></div>
              <div
                class="resize-handle sw"
                onpointerdown={(e) => startResize(el.id, 'sw', e)}
                role="presentation"
              ></div>
              <div
                class="resize-handle se"
                onpointerdown={(e) => startResize(el.id, 'se', e)}
                role="presentation"
              ></div>

              <!-- Ручки вращения (вынесены чуть наружу по диагонали) -->
              <div
                class="rotate-handle nw"
                title={t('viewport.rotate') ?? 'Rotate'}
                onpointerdown={(e) => startRotate(el.id, e)}
                role="presentation"
              ></div>
              <div
                class="rotate-handle ne"
                title={t('viewport.rotate') ?? 'Rotate'}
                onpointerdown={(e) => startRotate(el.id, e)}
                role="presentation"
              ></div>
              <div
                class="rotate-handle sw"
                title={t('viewport.rotate') ?? 'Rotate'}
                onpointerdown={(e) => startRotate(el.id, e)}
                role="presentation"
              ></div>
              <div
                class="rotate-handle se"
                title={t('viewport.rotate') ?? 'Rotate'}
                onpointerdown={(e) => startRotate(el.id, e)}
                role="presentation"
              ></div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
    <div class="viewport-toolbar">
      <span class="slide-info">
        {t('viewport.slide')} {presentation.currentSlideIndex + 1} / {presentation.slides.length}
        · {Math.round(scale * 100)}%
      </span>
      {#if panX !== 0 || panY !== 0 || zoom !== 1}
        <button
          class="ghost"
          onclick={() => { panX = 0; panY = 0; zoom = 1; }}
          title={t('viewport.resetView')}
        ><RotateCcw size={14} strokeWidth={1.75} /> {t('viewport.resetView')}</button>
      {/if}
      {#if presentation.selectedElementId}
        <button class="ghost" onclick={deleteSelected}>
          <Trash size={14} strokeWidth={1.75} /> {t('viewport.delete')}
        </button>
      {/if}
    </div>
  {:else}
    <div class="empty-state">
      <div class="empty-icon"><Clapperboard opacity={0.5} size={90} strokeWidth={1.75} /></div>
      <p>{t('viewport.empty')}</p>
      <button class="primary" style="font-size: 18px;" onclick={() => presentation.addSlide()}>
        <Plus strokeWidth={2} />
      </button>
    </div>
  {/if}
</div>

<style>
    .viewport {
      position: relative;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background:
        radial-gradient(circle at 20% 10%, rgba(124, 108, 240, 0.08), transparent 40%),
        radial-gradient(circle at 80% 90%, rgba(96, 165, 250, 0.06), transparent 45%),
        var(--bg-primary);
      overflow: hidden;
      background-image:
        radial-gradient(circle at 20% 10%, rgba(124, 108, 240, 0.08), transparent 40%),
        radial-gradient(circle at 80% 90%, rgba(96, 165, 250, 0.06), transparent 45%),
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: auto, auto, 24px 24px, 24px 24px;
      cursor: default;
      user-select: none;
      isolation: isolate;
      min-height: 0;
    }

    .viewport:active {
      cursor: grabbing;
    }

    .viewport.drop-active {
      outline: 2px dashed var(--accent-primary);
      outline-offset: -8px;
      background-color: var(--accent-dim);
    }

    /* ---------- КАНВАС ---------- */

    .slide-canvas {
        width: 1280px;
        height: 720px;
        overflow: hidden;
        isolation: isolate;
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        position: relative;
        transform-origin: center center;
        will-change: transform;
        backface-visibility: hidden;
    }

    /* ---------- ЭЛЕМЕНТ ---------- */

    .slide-element {
      position: absolute;
      cursor: grab;
      user-select: none;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .slide-element:hover {
      border-color: var(--border-strong);
    }

    .slide-element.selected {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px var(--accent-dim);
    }

    .slide-element:active {
      cursor: grabbing;
    }

    .slide-element.editing {
      border-color: var(--accent-primary);
      border-style: dashed;
      cursor: default;
    }

    /* ---------- СЛОЙ ИЗОЛЯЦИИ ---------- */
    /* Используется только для canvas/SVG/video, чтобы backdrop-filter
       не раздувал html. Для image и text не нужен. */
    .isolate-layer {
      width: 100%;
      height: 100%;
      position: relative;
      isolation: isolate;
      contain: layout style;
      transform: translateZ(0);
    }

    /* ---------- РУЧКИ РЕСАЙЗА ---------- */

    .resize-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      background: var(--accent-primary);
      border: 2px solid var(--bg-secondary);
      border-radius: 50%;
      z-index: 10;
      pointer-events: all;
    }

    .resize-handle.nw { top: -5px; left: -5px; cursor: nwse-resize; }
    .resize-handle.ne { top: -5px; right: -5px; cursor: nesw-resize; }
    .resize-handle.sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
    .resize-handle.se { bottom: -5px; right: -5px; cursor: nwse-resize; }

    /* ---------- Полоски-хваталки по краям фрейма ---------- */

    .frame-edge {
      position: absolute;
      z-index: 5;
      pointer-events: all;
      cursor: pointer;
      /* невидимые, но ловят клик */
      background: transparent;
    }

    /* Ширина полосок — 6px. Можно увеличить, если сложно попасть. */
    .frame-edge-left,
    .frame-edge-right {
      top: 0;
      bottom: 0;
      width: 6px;
    }

    .frame-edge-top,
    .frame-edge-bottom {
      left: 0;
      right: 0;
      height: 6px;
    }

    .frame-edge-left   { left: -3px; }
    .frame-edge-right  { right: -3px; }
    .frame-edge-top    { top: -3px; }
    .frame-edge-bottom { bottom: -3px; }

    /* Подсветка при ховере, чтобы пользователь понимал, что клик сработает */
    .frame-edge:hover {
      background: var(--accent-primary);
      opacity: 0.4;
    }

    /* ---------- РУЧКИ ВРАЩЕНИЯ ---------- */

    .rotate-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      background: var(--bg-elevated);
      border: 2px solid var(--accent-primary);
      border-radius: 50%;
      z-index: 11;
      pointer-events: all;
      cursor: grab;
    }
    .rotate-handle:active { cursor: grabbing; }

    .rotate-handle.nw { top: -22px; left: -22px; }
    .rotate-handle.ne { top: -22px; right: -22px; }
    .rotate-handle.sw { bottom: -22px; left: -22px; }
    .rotate-handle.se { bottom: -22px; right: -22px; }

    /* ---------- ТУЛБАР ---------- */

    .viewport-toolbar {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 14px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: 999px;
      box-shadow: var(--shadow-md);
      font-size: 12px;
      color: var(--text-secondary);
      backdrop-filter: blur(8px);
    }

    .slide-info {
      font-variant-numeric: tabular-nums;
    }

    .viewport-toolbar button {
      padding: 4px 10px;
      font-size: 12px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      color: var(--text-muted);
    }

    .empty-state > p {
        font-size: 30px;
    }

    .resize-tooltip {
      position: absolute;
      transform: translateX(-50%);
      padding: 2px 8px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: 4px;
      font-size: 11px;
      font-family: var(--font-mono);
      color: var(--text-primary);
      pointer-events: none;
      z-index: 100;
      white-space: nowrap;
    }

    /* ---------- КОНТЕНТ ЭЛЕМЕНТА ---------- */
    /*
      Тени (внешняя и внутренняя) применяются к САМОМУ СОДЕРЖИМОМУ,
      а не к фрейму.

      - --element-filter: drop-shadow(...) + blur(...) — применяется к <img>,
        <svg>, <canvas>, <video> и .el-text.
      - --inner-shadow: inset box-shadow — применяется к .media-wrapper
        (для картинок и видео), к .el-text, и к SVG через SVG-фильтр.
      Переменные объявляются в inline-стиле .element-content и наследуются детьми.
    */

    .element-content {
      position: relative;
      width: 100%;
      height: 100%;
      z-index: 1;
      overflow: visible;
    }

    .snap-guide {
      position: absolute;
      pointer-events: none;
      z-index: 9999;
      background: #ff5eb0; /* контрастный розовый */
      box-shadow: 0 0 4px rgba(255, 94, 176, 0.6);
    }

    .snap-guide-x {
      top: 0;
      bottom: 0;
      width: 1px;
      transform: translateX(-0.5px);
    }

    .snap-guide-y {
      left: 0;
      right: 0;
      height: 1px;
      transform: translateY(-0.5px);
    }

    /* ---------- ОБЁРТКА МЕДИА (картинка и видео) ---------- */
    /*
      .media-wrapper держит inset box-shadow и border-radius, чтобы они
      не конфликтовали с filter: drop-shadow на самом <img>.
      Внешняя тень идёт по контуру картинки (drop-shadow на <img>),
      внутренняя — по краям прямоугольника обёртки (inset box-shadow).
    */
    .media-wrapper {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .media-wrapper > :global(img),
    .media-wrapper > :global(svg) {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      display: block;
      filter: var(--element-filter, none);
    }

    /* Скругление применяется к самому медиа-элементу */
    .media-wrapper > :global(img),
    .media-wrapper > :global(svg),
    .element-content > :global(img),
    .element-content > :global(svg),
    .element-content > :global(canvas),
    .element-content > :global(table),
    .element-content > :global(.el-text) {
      border-radius: var(--element-radius, 0);
      clip-path: var(--element-clip-path, none);
    }

    /* ---------- SVG И CANVAS ---------- */
    /*
      Для SVG внешняя тень через CSS filter, внутренняя — через SVG-фильтр
      внутри самого <svg> (см. ShapeView). CSS box-shadow на SVG не применяем,
      чтобы не дублировать тень.
      Для canvas (Chart.js) внутренняя тень через CSS box-shadow на самом canvas,
      но с filter: drop-shadow они конфликтуют — поэтому только drop-shadow.
    */
    .element-content :global(.isolate-layer > svg),
    .element-content :global(.isolate-layer > canvas),
    .element-content > :global(svg),
    .element-content > :global(canvas) {
      filter: var(--element-filter, none);
      display: block;
      width: 100%;
      height: 100%;
      border-radius: var(--element-radius, 0);
      clip-path: var(--element-clip-path, none);
    }
</style>
