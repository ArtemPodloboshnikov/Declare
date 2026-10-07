import { t } from "$lib/i18n";
import { escapeAttr, escapeHtml, parseOutline } from "$lib/services/common";
import { buildSvgInnerShadowFilter, splitElementStyles } from "$lib/services/element-effects";
import { createHistory } from "$lib/services/history.svelte";
import { parseNewElement } from "$lib/services/import-html";
import { SHAPES } from "$lib/services/shapes";
import { backgroundToStyle } from "$lib/services/slide-backgrounds";
import { TRANSITION_DURATION_DEFAULT } from "$lib/services/transitions";

export type SlideElementType =
  | 'text' | 'image' | 'audio' | 'video'
  | 'chart' | 'table' | 'shape';

export type ShapeKind =
  | 'circle' | 'rect' | 'triangle' | 'star' | 'arrow'
  | 'hexagon' | 'pentagon' | 'diamond' | 'line';

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface ShapeData {
  kind: ShapeKind;
  /** Для маски: ID элемента, к которому применяется эта фигура как маска */
  maskTargetId?: string;
  /** SVG path для кастомных фигур (после булевых операций) */
  customPath?: string;
}

interface TextStyle {
  fontFamily?: string;   // "Arial"
  fontWeight?: string;   // "400" / "700"
  fontStyle?: string;    // "normal" / "italic"
  fontStyleName?: string; // "Bold Italic" — для чтения файла
  fontSize?: string;     // "24px"
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface ElementEffects {
  /** Внешняя тень: x, y, blur, spread, color */
  dropShadow?: {
    x: number; y: number; blur: number; spread: number;
    color: string; enabled: boolean;
  };
  /** Внутренняя тень */
  innerShadow?: {
    x: number; y: number; blur: number; spread: number;
    color: string; enabled: boolean;
  };
  /** Размытие содержимого элемента */
  blur?: { radius: number; enabled: boolean };
  /** Размытие фона позади элемента (backdrop-filter) */
  backdropBlur?: { radius: number; enabled: boolean };
}

export interface ElementTransform {
  /** Вращение в градусах */
  rotation?: number;
  /** Отражение по горизонтали */
  flipX?: boolean;
  /** Отражение по вертикали */
  flipY?: boolean;
  /** Радиус скругления углов */
  borderRadius?: number;
  /** Уровень сглаживания углов: 0 — обычное, 1 — squircle (iOS) */
  cornerSmoothing?: number;
  /** Прозрачность 0..1 */
  opacity?: number;
  /** Режим наложения */
  blendMode?: GlobalCompositeOperation | 'normal';
  /** Обводка: цвет и толщина */
  outlineColor?: string;
  outlineWidth?: number;
}

export type AnimationTrigger = 'onClick' | 'withPrevious' | 'afterPrevious';

export type AnimationKind =
  | 'none'
  | 'fade'
  | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right'
  | 'zoom-in' | 'zoom-out'
  | 'rotate'
  | 'flip'
  | 'bounce'
  | 'spin'
  | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down'
  | 'grow' | 'shrink'
  | 'drop' | 'rise'
  | 'pulse';

export interface ElementAnimation {
  kind: AnimationKind;
  trigger: AnimationTrigger;
  /** Длительность в миллисекундах */
  duration: number;
  /** Задержка в миллисекундах (для afterPrevious) */
  delay: number;
  /** Направление для сдвигов/вращений */
  direction?: 'forward' | 'reverse';
  /** Easing */
  easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear' | 'spring';
}

export interface AudioSettings {
  /** Автовоспроизведение при появлении слайда */
  autoplay: boolean;
  /** Зациклить воспроизведение */
  loop: boolean;
  /** Играть при клике на слайд (для экспорта) */
  playOnClick: boolean;
  /** Скрыть плеер при показе */
  hideControls: boolean;
  /** Показывать плеер только на слайде, где он лежит */
  stopOnSlideLeave: boolean;
  /** Громкость по умолчанию 0..1 */
  volume: number;
  /** Сдвиг начала воспроизведения в секундах */
  startTime: number;
  /** Обрезка по конец в секундах (0 = до конца) */
  endTime: number;
  /** Тримминг визуального плеера */
  playerStyle: 'minimal' | 'compact' | 'full';
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  autoplay: false,
  loop: false,
  playOnClick: false,
  hideControls: false,
  stopOnSlideLeave: true,
  volume: 1,
  startTime: 0,
  endTime: 0,
  playerStyle: 'compact'
};

export type VideoSourceType = 'file' | 'embed';

export interface VideoSettings {
  /** Тип источника: локальный файл или встраиваемый URL */
  sourceType: VideoSourceType;
  /** Для embed: провайдер (youtube, rutube, vk, custom) */
  embedProvider?: EmbedProvider;
  /** Для embed: исходный URL */
  embedUrl?: string;

  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  controls: boolean;
  playOnClick: boolean;
  stopOnSlideLeave: boolean;
  volume: number;
  startTime: number;
  endTime: number;

  /** Вид плеера для локальных файлов */
  playerStyle: 'minimal' | 'compact' | 'full';
}

export type EmbedProvider = 'youtube' | 'rutube' | 'vk' | 'dzen' | 'custom';

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  sourceType: 'file',
  autoplay: false,
  loop: false,
  muted: false,
  controls: true,
  playOnClick: false,
  stopOnSlideLeave: true,
  volume: 1,
  startTime: 0,
  endTime: 0,
  playerStyle: 'compact'
};

export interface TableSettings {
  /** Показывать ли заголовок */
  showHeader: boolean;
  /** Цвет фона заголовка */
  headerBg: string;
  /** Цвет текста заголовка */
  headerColor: string;
  /** Цвет текста ячеек */
  cellColor: string;
  /** Цвет границ */
  borderColor: string;
  /** Толщина границ (px при 1280) */
  borderWidth: number;
  /** Чередование строк (zebra) */
  striped: boolean;
  /** Цвет чётных строк */
  stripeColor: string;
  /** Размер шрифта (px при 1280) */
  fontSize: number;
  /** Выравнивание текста */
  textAlign: 'left' | 'center' | 'right';
  /** Внутренние отступы (px при 1280) */
  paddingX: number;
  paddingY: number;
}

export const DEFAULT_TABLE_SETTINGS: TableSettings = {
  showHeader: true,
  headerBg: '#1e1e28',
  headerColor: '#e8e8f0',
  cellColor: '#e8e8f0',
  borderColor: '#2a2a38',
  borderWidth: 1,
  striped: true,
  stripeColor: 'rgba(255, 255, 255, 0.02)',
  fontSize: 13,
  textAlign: 'left',
  paddingX: 10,
  paddingY: 6
};

export interface ChartSettings {
  /** Показывать название серии (dataset label) */
  showDatasetLabel: boolean;
  /** Цвет текста названия серии */
  datasetLabelColor: string;
  /** Размер шрифта названия серии (px при 1280) */
  datasetLabelSize: number;

  /** Показывать легенду (для круговых) */
  showLegend: boolean;
  /** Цвет текста легенды */
  legendColor: string;
  /** Размер шрифта легенды */
  legendSize: number;

  /** Размер шрифта подписей осей */
  axisLabelSize: number;
  /** Цвет подписей осей */
  axisLabelColor: string;
  /** Цвет сетки */
  gridColor: string;
}

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  showDatasetLabel: true,
  datasetLabelColor: '#e8e8f0',
  datasetLabelSize: 13,

  showLegend: true,
  legendColor: '#e8e8f0',
  legendSize: 13,

  axisLabelSize: 12,
  axisLabelColor: '#a0a0b8',
  gridColor: 'rgba(255,255,255,0.05)'
};

export interface SlideElement {
  id: string;
  type: SlideElementType;
  shape?: ShapeData;
  content: string;
  style: TextStyle & ShapeStyle;
  position: { x: number; y: number; width: number; height: number };
  effects?: ElementEffects;
  transform?: ElementTransform;
  animation?: ElementAnimation;
  audio?: AudioSettings;
  video?: VideoSettings;
  table?: TableSettings;
  chart?: ChartSettings;
}

export type SlideBackgroundType = 'preset' | 'color' | 'image';

export interface SlideBackground {
  type: SlideBackgroundType;
  /** id пресета из BACKGROUND_PRESETS */
  presetId?: string;
  /** CSS color для type === 'color' */
  color?: string;
  /** blob: URL или data: URL для type === 'image' */
  imageUrl?: string;
  /** Как картинка заполняет фон */
  imageFit?: 'cover' | 'contain' | 'repeat';
}

export interface Slide {
  id: string;
  title: string;
  elements: SlideElement[];
  transition: string;
  transitionDuration: number;
  background?: SlideBackground;
}

/**
 * Превращает слайд в HTML-строку со всеми элементами.
 * Формат совместим с export.ts — те же inline-стили.
 */
function slideToHtml(slide: Slide): string {
  const elementsHtml = slide.elements
    .filter(el => !(el.style as any)?.hidden)
    .map(el => elementToHtml(el, slide))
    .join('\n  ');

  const bgStyle = backgroundToStyle(slide.background);

  return `<div class="slide-inner" data-slide-id="${slide.id}" style="${bgStyle}">
  ${elementsHtml}
</div>`;
}

function elementToHtml(el: SlideElement, slide: Slide): string {
  const pos = el.position;
  const split = splitElementStyles(el, {
    unit: 'px',
    canvasWidth: 1280,
    skipBackdrop: false
  });

  const basePosition = [
    `position: absolute`,
    `left: ${pos.x}px`,
    `top: ${pos.y}px`,
    `width: ${pos.width}px`,
    `height: ${pos.height}px`
  ].join('; ');

  const content = renderInnerContent(el, slide);

  const backdropHtml = split.backdrop
    ? `<div class="element-backdrop" style="${split.backdrop};"></div>`
    : '';

  const contentHtml = split.content
    ? `<div class="element-content" style="${split.content};">${content}</div>`
    : `<div class="element-content">${content}</div>`;

  return `<div class="slide-element" data-id="${el.id}" data-type="${el.type}" style="${basePosition}; ${split.container};">
    ${backdropHtml}
    ${contentHtml}
  </div>`;
}

function renderInnerContent(el: SlideElement, slide: Slide): string {
  switch (el.type) {
    case 'text':
      return `<div class="el-text">${el.content}</div>`;

    case 'image':
      return `<div class="media-wrapper"><img src="${el.content}" alt="" /></div>`;

    case 'audio':
      return `<audio controls src="${el.content}"></audio>`;

    case 'video':
      return `<div class="media-wrapper"><video controls src="${el.content}"></video></div>`;

    case 'chart':
      return `<canvas data-chart='${escapeAttr(el.content || '{}')}'></canvas>`;

    case 'table': {
      let data: { headers: string[]; rows: string[][] };
      try {
        data = JSON.parse(el.content || '{"headers":[],"rows":[]}');
      } catch {
        data = { headers: [], rows: [] };
      }
      const head = data.headers.length
        ? `<thead><tr>${data.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`
        : '';
      const body = `<tbody>${data.rows.map(r =>
        `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
      ).join('')}</tbody>`;
      return `<table class="exp-table">${head}${body}</table>`;
    }

    case 'shape': {
      const def = SHAPES.find(s => s.kind === (el.shape?.kind ?? 'rect'));
      const path = el.shape?.customPath ?? def?.path ?? '';
      const outline = def?.outline === true;
      const fill = outline ? 'none' : (el.style?.fill ?? '#7c6cf0');
      const stroke = outline
        ? (el.style?.stroke ?? el.style?.fill ?? '#7c6cf0')
        : (el.style?.stroke ?? 'none');
      const strokeWidth = outline
        ? (el.style?.strokeWidth ?? 3)
        : (el.style?.strokeWidth ?? 0);

      // Внутренняя тень через SVG-фильтр
      const filterId = `inner-shadow-${el.id}`;
      const filterSvg = buildSvgInnerShadowFilter(el, filterId);
      const filterRef = filterSvg ? `url(#${filterId})` : '';

      return `<svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        ${filterSvg ? `<defs>${filterSvg}</defs>` : ''}
        <path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" ${filterRef ? `filter="${filterRef}"` : ''} />
      </svg>`;
    }

    default:
      return '';
  }
}

/**
 * Обратный разбор: HTML → элементы слайда.
 * Ищет все элементы с data-id и обновляет их позиции, стили, содержимое.
 * Элементы без data-id игнорируются (чтобы не сломать структуру).
 */
function htmlToSlide(html: string, currentSlide: Slide): Slide {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<root>${html}</root>`, 'text/html');
  const root = doc.querySelector('root');
  if (!root) return currentSlide;

  const slideInner = root.querySelector('.slide-inner');
  if (!slideInner) return currentSlide;

  const updatedElements: SlideElement[] = [];

  slideInner.querySelectorAll<HTMLElement>(':scope > .slide-element').forEach(node => {
    const id = node.dataset.id;
    const existing = id
      ? currentSlide.elements.find(e => e.id === id)
      : null;

    // Если элемента с таким id нет — создаём новый
    if (!existing) {
      const newEl = parseNewElement(node);
      if (newEl) updatedElements.push(newEl);
      return;
    }

    // Позиция
    const position = {
      x: Math.round(parseFloat(node.style.left) || existing.position.x),
      y: Math.round(parseFloat(node.style.top) || existing.position.y),
      width: Math.round(parseFloat(node.style.width) || existing.position.width),
      height: Math.round(parseFloat(node.style.height) || existing.position.height)
    };

    // Стили и эффекты из .element-content
    const content = node.querySelector<HTMLElement>(':scope > .element-content');
    const style = content
      ? { ...existing.style, ...parseContentStyle(content) }
      : existing.style;
    const transform = content
      ? { ...existing.transform, ...parseContentTransform(content) }
      : existing.transform;
    const effects = content
      ? { ...existing.effects, ...parseContentEffects(content) }
      : existing.effects;

    // Обводка
    const outline = content ? parseOutline(content) : {};
    const mergedTransform = { ...transform, ...outline };

    // Контент — в зависимости от типа
    let content_value = existing.content;
    const contentRoot = content ?? node;

    if (existing.type === 'text') {
      const textEl = contentRoot.querySelector<HTMLElement>('.el-text');
      if (textEl) content_value = textEl.innerHTML;
    } else if (existing.type === 'image') {
      const img = contentRoot.querySelector<HTMLImageElement>('img');
      if (img) content_value = img.getAttribute('src') ?? content_value;
    } else if (existing.type === 'audio') {
      const audio = contentRoot.querySelector<HTMLAudioElement>('audio');
      if (audio) content_value = audio.getAttribute('src') ?? content_value;
    } else if (existing.type === 'video') {
      const video = contentRoot.querySelector<HTMLVideoElement>('video');
      if (video) content_value = video.getAttribute('src') ?? content_value;
    } else if (existing.type === 'chart') {
      const canvas = contentRoot.querySelector<HTMLCanvasElement>('canvas[data-chart]');
      if (canvas) content_value = canvas.getAttribute('data-chart') ?? content_value;
    } else if (existing.type === 'table') {
      const table = contentRoot.querySelector<HTMLTableElement>('table.exp-table');
      if (table) content_value = tableToJson(table);
    } else if (existing.type === 'shape') {
      const pathEl = contentRoot.querySelector<SVGPathElement>('path');
      if (pathEl) {
        const path = pathEl.getAttribute('d') ?? '';
        const fill = pathEl.getAttribute('fill') ?? '#7c6cf0';
        const stroke = pathEl.getAttribute('stroke') ?? 'none';
        const strokeWidth = parseFloat(pathEl.getAttribute('stroke-width') ?? '0') || 0;
        existing.shape = { ...(existing.shape ?? { kind: 'rect' }), customPath: path };
        existing.style = { ...style, fill, stroke, strokeWidth };
        updatedElements.push({
          ...existing,
          position,
          transform: mergedTransform,
          effects
        });
        return;
      }
    }

    updatedElements.push({
      ...existing,
      position,
      style,
      transform: mergedTransform,
      effects,
      content: content_value
    });
  });

  return { ...currentSlide, elements: updatedElements };
}

function parseContentStyle(content: HTMLElement): SlideElement['style'] {
  const style: SlideElement['style'] = {};
  const skip = ['position', 'left', 'top', 'width', 'height', 'z-index', 'overflow', 'contain', 'isolation'];

  for (const prop of Array.from(content.style)) {
    if (skip.includes(prop)) continue;
    if (prop.startsWith('--')) continue;

    const value = content.style.getPropertyValue(prop);
    const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

    if (camel === 'strokeWidth') {
      const n = parseFloat(value);
      (style as any)[camel] = Number.isNaN(n) ? 0 : n;
    } else {
      (style as any)[camel] = value;
    }
  }

  return style;
}

function parseContentTransform(content: HTMLElement): ElementTransform {
  const t: ElementTransform = {};

  const opacity = parseFloat(content.style.opacity);
  if (!Number.isNaN(opacity) && opacity < 1) t.opacity = opacity;

  const blend = content.style.mixBlendMode;
  if (blend && blend !== 'normal') t.blendMode = blend as any;

  const tr = content.style.transform || '';
  const rotate = tr.match(/rotate\((-?[\d.]+)deg\)/);
  if (rotate) t.rotation = parseFloat(rotate[1]);
  if (/scaleX\(-1\)/.test(tr)) t.flipX = true;
  if (/scaleY\(-1\)/.test(tr)) t.flipY = true;

  const radiusRaw = content.style.getPropertyValue('--element-radius') || '';
  const radiusPx = parseFloat(radiusRaw);
  if (!Number.isNaN(radiusPx) && radiusPx > 0) t.borderRadius = radiusPx;

  const clip = content.style.getPropertyValue('--element-clip-path') || '';
  if (clip.startsWith('path(')) {
    if (!t.borderRadius) t.borderRadius = 20;
  }

  return t;
}

function parseContentEffects(content: HTMLElement): ElementEffects {
  const effects: ElementEffects = {};

  const filterRaw = content.style.getPropertyValue('--element-filter') || '';
  const innerRaw = content.style.getPropertyValue('--inner-shadow') || '';

  if (filterRaw) {
    const ds = filterRaw.match(
      /drop-shadow\(\s*(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+((?:rgba?|hsla?)\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-z]+)\s*\)/
    );
    if (ds) {
      effects.dropShadow = {
        enabled: true,
        x: parseFloat(ds[1]),
        y: parseFloat(ds[2]),
        blur: parseFloat(ds[3]),
        spread: 0,
        color: ds[4].trim()
      };
    }

    const bl = filterRaw.match(/blur\(\s*([\d.]+)px\s*\)/);
    if (bl) {
      effects.blur = { enabled: true, radius: parseFloat(bl[1]) };
    }
  }

  if (innerRaw) {
    const im = innerRaw.match(/inset\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(.+?);?\s*$/);
    if (im) {
      effects.innerShadow = {
        enabled: true,
        x: parseFloat(im[1]),
        y: parseFloat(im[2]),
        blur: parseFloat(im[3]),
        spread: parseFloat(im[4]),
        color: im[5].trim().replace(/;$/, '')
      };
    }
  }

  return effects;
}

function tableToJson(table: HTMLTableElement): string {
  const headers: string[] = [];
  const rows: string[][] = [];
  table.querySelectorAll('thead th').forEach(th => headers.push(th.textContent?.trim() ?? ''));
  table.querySelectorAll('tbody tr').forEach(tr => {
    const cells: string[] = [];
    tr.querySelectorAll('td').forEach(td => cells.push(td.textContent?.trim() ?? ''));
    rows.push(cells);
  });
  return JSON.stringify({ headers, rows });
}

function createPresentationStore() {
  let history = createHistory<Slide[]>([]);
  let slides = $derived(history.present);
  let updateDebounce: ReturnType<typeof setTimeout> | null = null;
  let currentSlideIndex = $state(0);
  let projectName = $state('untitled-presentation');
  let selectedElementIds = $state<string[]>([]);
  let selectedElementId = $derived(selectedElementIds[0] ?? null);
  let editingShapeId = $state<string | null>(null);

  let currentSlide = $derived(slides[currentSlideIndex]);

  function withHistory(mutator: (draft: Slide[]) => void) {
    // Клонируем текущее состояние, чтобы снимок был независим
    const draft = structuredClone($state.snapshot(slides)) as Slide[];
    mutator(draft);
    history.commit(draft);
  }

  return {
    get slides() { return slides; },
    get currentSlideIndex() { return currentSlideIndex; },
    get currentSlide() { return currentSlide; },
    get projectName() { return projectName; },
    set projectName(v: string) { projectName = v || 'untitled-presentation'; },
    get editingShapeId() { return editingShapeId; },
    enterShapeEdit(id: string) { editingShapeId = id; },
    exitShapeEdit() { editingShapeId = null; },
    get selectedElementId() { return selectedElementId; },
    set selectedElementIds(v: string[]) { selectedElementIds = v },
    set selectedElementId(v: string | null) {
      selectedElementIds = v === null ? [] : [v];
    },
    set currentSlideIndex(v: number) { currentSlideIndex = v; },
    selectElement(id: string | null, additive = false) {
      if (id === null) {
        selectedElementIds = [];
      } else if (additive) {
        if (selectedElementIds.includes(id)) {
          selectedElementIds = selectedElementIds.filter(x => x !== id);
        } else {
          selectedElementIds = [...selectedElementIds, id];
        }
      } else {
        selectedElementIds = [id];
      }
    },
    get selectedElementIds() { return selectedElementIds; },

    get canUndo() { return history.canUndo; },
    get canRedo() { return history.canRedo; },
    undo() { history.undo(); },
    redo() { history.redo(); },

    addSlide() {
      withHistory(draft => {
        draft.push({
          id: crypto.randomUUID(),
          title: `${t("viewport.slide")} ${draft.length + 1}`,
          elements: [],
          transition: 'fade',
          transitionDuration: TRANSITION_DURATION_DEFAULT * 1000,
          background: { type: 'preset', presetId: 'dark-solid' }
        });
      })
      currentSlideIndex = history.present.length - 1;
    },

    duplicateSlide(index: number) {
      withHistory(draft => {
        const source = draft[index];
        if (!source) return;
        draft.splice(index + 1, 0, {
          ...structuredClone($state.snapshot(source)),
          id: crypto.randomUUID(),
          title: `${source.title} (copy)`,
          elements: source.elements.map(el => ({
            ...structuredClone($state.snapshot(el)),
            id: crypto.randomUUID()
          }))
        });
      });
    },

    removeSlide(index: number) {
      withHistory(draft => {
        draft.splice(index, 1);
      });
      if (currentSlideIndex >= history.present.length) {
        currentSlideIndex = history.present.length - 1;
      }
    },

    moveSlide(fromIdx: number, toIdx: number) {
      if (fromIdx === toIdx) return;
      if (fromIdx < 0 || fromIdx >= slides.length) return;
      if (toIdx < 0 || toIdx >= slides.length) return;
      withHistory(draft => {
        const [moved] = draft.splice(fromIdx, 1);
        draft.splice(toIdx, 0, moved);
        draft = draft.map((slide, idx) => {
          if (!slide.title.includes(t("viewport.slide"))) return slide
          if (toIdx <= idx) {
            return { ...slide, title: `${t("viewport.slide")} ${idx + 1}` }
          }

          return slide
        })
      });

      if (currentSlideIndex === fromIdx) currentSlideIndex = toIdx;
      else if (currentSlideIndex > fromIdx && currentSlideIndex <= toIdx) currentSlideIndex--;
      else if (currentSlideIndex < fromIdx && currentSlideIndex >= toIdx) currentSlideIndex++;
    },

    addElement(element: SlideElement) {
      withHistory(draft => {
        const slide = draft[currentSlideIndex];
        if (slide) slide.elements.push(element);
      });
    },

    addElements(elements: SlideElement[]) {
      withHistory(draft => {
        const slide = draft[currentSlideIndex];
        if (!slide) return;
        slide.elements.push(...elements);
      });
    },

    removeElement(id: string) {
      withHistory(draft => {
        const slide = draft[currentSlideIndex];
        if (!slide) return;
        slide.elements = slide.elements.filter(e => e.id !== id);
      });
      selectedElementIds = selectedElementIds.filter(x => x !== id);
    },

    removeElements(ids: string[]) {
      withHistory(draft => {
        const slide = draft[currentSlideIndex];
        if (!slide) return;
        slide.elements = slide.elements.filter(e => !ids.includes(e.id));
      });
      selectedElementIds = selectedElementIds.filter(x => !ids.includes(x));
    },

    updateElement(id: string, updates: Partial<SlideElement>, debounce = false) {
      const apply = (draft: Slide[]) => {
        const slide = draft[currentSlideIndex];
        const el = slide?.elements.find(e => e.id === id);
        if (el) Object.assign(el, updates);
      };

      if (debounce) {
        // Обновляем без истории
        apply(slides);
        if (updateDebounce) clearTimeout(updateDebounce);
        updateDebounce = setTimeout(() => {
          history.commit(structuredClone($state.snapshot(slides)));
        }, 500);
      } else {
        withHistory(apply);
      }
    },

    replaceSlide(index: number, slide: Slide) {
      withHistory(draft => {
        if (index >= 0 && index < draft.length) {
          draft[index] = slide;
        }
      });
    },

    replaceAllSlides(newSlides: Slide[]) {
      withHistory(draft => {
        draft.length = 0;
        draft.push(...newSlides);
      });
      currentSlideIndex = 0;
      selectedElementIds = [];
    },

    replaceShapes(ids: string[], merged: SlideElement) {
      withHistory(draft => {
        const slide = draft[currentSlideIndex];
        if (!slide) return;
        slide.elements = slide.elements.filter(e => !ids.includes(e.id));
        slide.elements.push(merged);
      });
    },

    getCurrentSlideHtml(): string {
      const slide = slides[currentSlideIndex];
      if (!slide) return '';
      return slideToHtml(slide);
    },

    applySlideHtml(html: string): void {
      const slide = slides[currentSlideIndex];
      if (!slide) return;
      const updated = htmlToSlide(html, slide);
      slides[currentSlideIndex] = updated;
    },

    applyBooleanOp(ids: string[], resultPath: string, style: SlideElement['style']) {
      withHistory(draft => {
        const slide = draft[currentSlideIndex];
        if (!slide) return;

        const shapes = slide.elements.filter(e => ids.includes(e.id));
        if (shapes.length !== 2) return;

        const [a, b] = shapes;

        // Bounding box объединения
        const x = Math.min(a.position.x, b.position.x);
        const y = Math.min(a.position.y, b.position.y);
        const right = Math.max(a.position.x + a.position.width, b.position.x + b.position.width);
        const bottom = Math.max(a.position.y + a.position.height, b.position.y + b.position.height);

        const merged: SlideElement = {
          id: crypto.randomUUID(),
          type: 'shape',
          content: '',
          shape: { kind: a.shape?.kind ?? 'rect', customPath: resultPath },
          style: { ...style },
          position: { x, y, width: right - x, height: bottom - y }
        };

        slide.elements = slide.elements.filter(e => !ids.includes(e.id));
        slide.elements.push(merged);
      });
    },

    moveElement(id: string, toIndex: number) {
      withHistory(draft => {
        const slide = draft[currentSlideIndex];
        if (!slide) return;
        const fromIndex = slide.elements.findIndex(el => el.id === id);
        if (fromIndex < 0) return;
        const clamped = Math.max(0, Math.min(slide.elements.length - 1, toIndex));
        if (fromIndex === clamped) return;
        const [moved] = slide.elements.splice(fromIndex, 1);
        slide.elements.splice(clamped, 0, moved);
      });
    },

    moveElementToEnd(id: string) {
      withHistory(draft => {
        const slide = draft[currentSlideIndex];
        if (!slide) return;
        const idx = slide.elements.findIndex(e => e.id === id);
        if (idx < 0) return;
        const [el] = slide.elements.splice(idx, 1);
        slide.elements.push(el);
      });
    },

    loadProject(name: string, slidesData: Slide[]) {
      history.reset([]);
      withHistory(draft => {
        draft.length = 0;
        draft.push(...structuredClone(slidesData));
      });
      currentSlideIndex = 0;
      projectName = name;
      selectedElementIds = [];
      history.reset(structuredClone(slidesData));
    },

    resetProject() {
      const fresh = [{
        id: crypto.randomUUID(),
        title: `${t('viewport.slide')} 1`,
        elements: [],
        transition: 'fade',
        transitionDuration: TRANSITION_DURATION_DEFAULT * 1000
      }];

      // Сбрасываем историю и устанавливаем новый проект
      history.reset(structuredClone(fresh));

      currentSlideIndex = 0;
      projectName = 'untitled-presentation';
      selectedElementIds = [];
    },

    commitPendingHistory() {
      if (updateDebounce) {
        clearTimeout(updateDebounce);
        updateDebounce = null;
      }
      history.commit(structuredClone($state.snapshot(history.present)));
    }
  };
}

export const presentation = createPresentationStore();
