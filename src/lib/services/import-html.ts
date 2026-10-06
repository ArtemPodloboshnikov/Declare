import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, exists, readFile } from '@tauri-apps/plugin-fs';
import { dirname, join } from '@tauri-apps/api/path';
import {
  type Slide,
  type SlideElement,
  type ElementEffects,
  type ElementTransform,
  type SlideBackground,
  type AudioSettings,
  DEFAULT_VIDEO_SETTINGS,
  type VideoSettings,
  type EmbedProvider,
  DEFAULT_TABLE_SETTINGS,
  type TableSettings,
  DEFAULT_CHART_SETTINGS,
  type ChartSettings,
} from '$lib/stores/presentation.svelte';
import { CANVAS_H, CANVAS_W } from '$lib/stores/app.svelte';
import { parseAnimation } from './animations';
import { t } from '$lib/i18n';
import { parseOutline, parseVwToPx } from './common';

export interface ImportResult {
  slides: Slide[];
  name: string;
  path: string;
}

async function registerFontsFromHtml(doc: Document, htmlPath: string) {
  const styleTags = doc.querySelectorAll('style');
  for (const style of styleTags) {
    const css = style.textContent ?? '';
    // Ищем @font-face
    const fontFaceRegex = /@font-face\s*\{([^}]+)\}/g;
    let match;
    while ((match = fontFaceRegex.exec(css)) !== null) {
      const block = match[1];
      const familyMatch = block.match(/font-family:\s*['"]?([^;'"]+)['"]?/);
      const srcMatch = block.match(/src:\s*url\(['"]?([^'")]+)['"]?\)/);
      if (!familyMatch || !srcMatch) continue;

      const family = familyMatch[1].trim();
      const src = srcMatch[1].trim();

      // Резолвим URL шрифта
      const resolvedSrc = await resolveAssetUrl(src, htmlPath);
      try {
        const fontFace = new FontFace(family, `url(${resolvedSrc})`);
        await fontFace.load();
        document.fonts.add(fontFace);
      } catch {}
    }
  }
}

/**
 * Импортирует слайд из HTML-строки.
 * Ожидает содержимое `.slide-inner` (как выдаёт AI) или полный `<section class="slide">`.
 */
export async function importSlideFromHtml(
  html: string,
  name = 'slide'
): Promise<Slide> {
  const parser = new DOMParser();
  let doc = parser.parseFromString(html, 'text/html');
  let section = doc.querySelector<HTMLElement>('section.slide');

  if (!section) {
    const innerMatch = html.match(
      /<div[^>]*class\s*=\s*["'][^"']*slide-inner[^"']*["'][^>]*>([\s\S]*)<\/div>\s*$/
    );
    const innerHtml = innerMatch ? innerMatch[1] : html;
    const wrapped = `<section class="slide"><div class="slide-inner">${innerHtml}</div></section>`;
    doc = parser.parseFromString(wrapped, 'text/html');
    section = doc.querySelector<HTMLElement>('section.slide');
  }

  if (!section) throw new Error('Could not parse slide HTML');

  const slide = await parseSlide(section, 0, '');
  slide.title = name;
  return slide;
}

export async function importSlidesFromHtml(html: string): Promise<Slide[]> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const slides: Slide[] = [];

  // 1. Полные section.slide
  const sections = doc.querySelectorAll<HTMLElement>('section.slide');
  if (sections.length) {
    for (let i = 0; i < sections.length; i++) {
      const slide = await parseSlide(sections[i], i, '');
      slide.title = `AI Slide ${i + 1}`;
      slides.push(slide);
    }
    return slides;
  }

  // 2. Отдельные .slide-inner
  const inners = doc.querySelectorAll<HTMLElement>('.slide-inner');
  if (inners.length) {
    for (let i = 0; i < inners.length; i++) {
      const wrapped = `<section class="slide"><div class="slide-inner">${inners[i].innerHTML}</div></section>`;
      const sdoc = parser.parseFromString(wrapped, 'text/html');
      const section = sdoc.querySelector<HTMLElement>('section.slide');
      if (!section) continue;
      const slide = await parseSlide(section, i, '');
      slide.title = `AI Slide ${i + 1}`;
      slides.push(slide);
    }
    return slides;
  }

  // 3. Одиночный слайд
  const single = await importSlideFromHtml(html);
  return [single];
}

export async function importHtmlPresentation(): Promise<ImportResult | null> {
  const picked = await open({
    title: 'Открыть презентацию',
    multiple: false,
    filters: [{ name: 'HTML', extensions: ['html', 'htm'] }]
  });

  if (!picked || Array.isArray(picked)) return null;

  const html = await readTextFile(picked);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  await registerFontsFromHtml(doc, picked);

  const name = doc.querySelector('title')?.textContent?.trim() || 'presentation';

  const slideEls = doc.querySelectorAll<HTMLElement>('section.slide');
  if (!slideEls.length) {
    throw new Error('В файле не найдено ни одного слайда');
  }

  const slides: Slide[] = [];

  for (let i = 0; i < slideEls.length; i++) {
    const slide = await parseSlide(slideEls[i], i, picked);
    slides.push(slide);
  }

  return { slides, name, path: picked };
}

async function parseSlide(
  section: HTMLElement,
  index: number,
  htmlPath: string
): Promise<Slide> {
  const inner = section.querySelector<HTMLElement>('.slide-inner');
  if (!inner) {
    return emptySlide(index);
  }

  const transition = section.dataset.transition ?? 'fade';
  const durationRaw = section.style.getPropertyValue('--transition-duration') || '700ms';
  const transitionDuration = parseInt(durationRaw) || 700;

  const titleFromData = section.dataset.title?.trim();
  const title = titleFromData || `${t("viewport.slide")} ${index + 1}`;

  const background = await parseBackgroundAsync(section);

  const elements: SlideElement[] = [];

  // Ищем все .slide-element — прямые дети .slide-inner
  const slideEls = Array.from(inner.children).filter(
    (node) => (node as HTMLElement).classList.contains('slide-element')
  );

  for (const node of slideEls) {
    const el = node as HTMLElement;
    const parsed = await parseElement(el, htmlPath);
    if (Array.isArray(parsed)) {
      elements.push(...parsed);
    } else if (parsed) {
      elements.push(parsed);
    }
  }

  return {
    id: crypto.randomUUID(),
    title,
    elements,
    transition,
    transitionDuration,
    background
  };
}

async function parseElement(
  el: HTMLElement,
  htmlPath: string
): Promise<SlideElement | SlideElement[] | null> {
  const position = parsePosition(el);

  // Контентный слой: там inline-стили эффектов
  const content = el.querySelector<HTMLElement>(':scope > .element-content');
  const style = content ? parseStyleFromContent(content) : parseStyle(el);
  const containerTransform = parseContainerTransform(el);
  const contentTransform = content ? parseContentTransform(content) : {};
  const effects = content ? parseEffects(content) : {};
  const animation = parseAnimation(el);
  const outline = content ? parseOutline(content) : {};
  const radius = content ? parseRadius(content) : {};
  const backdrop = parseBackdrop(el);

  const transform: ElementTransform = {
    ...containerTransform,
    ...contentTransform,
    ...outline,
    ...radius
  };


  Object.assign(effects, backdrop);

  const id = crypto.randomUUID();
  const contentRoot = content ?? el;

  // ---------- Медиа с маской (картинка/видео внутри SVG с clipPath) ----------
  const maskResult = await parseMaskedMedia(
    el,
    content ?? el,
    { style, position, transform, effects, animation },
    htmlPath
  );
  if (maskResult) return maskResult;

  // Фигура — <svg class="shape-svg">
  const shapeSvg = contentRoot.querySelector<SVGSVGElement>('svg.shape-svg');
  if (shapeSvg) {
    const pathEl = shapeSvg.querySelector<SVGPathElement>('path');
    if (!pathEl) return null;
    const path = pathEl.getAttribute('d') ?? '';
    const fill = pathEl.getAttribute('fill') ?? '#7c6cf0';
    const stroke = pathEl.getAttribute('stroke') ?? 'none';
    const strokeWidth = parseFloat(pathEl.getAttribute('stroke-width') ?? '0') || 0;

    // Внутренняя тень фигуры — из SVG-фильтра
    const svgInnerShadow = parseSvgInnerShadow(shapeSvg);
    if (svgInnerShadow) {
      effects.innerShadow = svgInnerShadow;
    }

    const pathStroke = pathEl.getAttribute('stroke') ?? 'none';
    const pathStrokeWidth = parseFloat(pathEl.getAttribute('stroke-width') ?? '0') || 0;

    const isLine = el.dataset.line === 'true' || /* определяется по path */ false;

    // Для не-line фигур stroke идёт как обводка фрейма
    if (!isLine && pathStroke !== 'none' && pathStrokeWidth > 0) {
      transform.outlineWidth = pathStrokeWidth;
      transform.outlineColor = pathStroke;
    }

    return {
      id,
      type: 'shape',
      content: '',
      shape: { kind: 'rect', customPath: path },
      style: { fill, stroke, strokeWidth },
      position,
      transform,
      effects,
      animation
    };
  }

  // Изображение
  const img = contentRoot.querySelector<HTMLImageElement>('img');
  if (img) {
    const rawSrc = img.getAttribute('src') ?? '';
    const src = await resolveAssetUrl(rawSrc, htmlPath);

    // Внешняя тень может быть на <img> или на <svg class="media-svg">
    const mediaSvg = contentRoot.querySelector<SVGSVGElement>('svg.media-svg');
    const directFilter = img.style.filter || mediaSvg?.style.filter || '';
    applyDirectFilter(effects, directFilter);

    // Скругление картинки может быть на <img> через border-radius
    const imgRadius = parseFloat(img.style.borderRadius || '');
    if (!transform.borderRadius && !Number.isNaN(imgRadius) && imgRadius > 0) {
      transform.borderRadius = Math.round(imgRadius);
    }

    return {
      id,
      type: 'image',
      content: src,
      style,
      position,
      transform,
      effects,
      animation
    };
  }

  // Аудио
  const audio = contentRoot.querySelector<HTMLAudioElement>('audio');
  if (audio) {
    const rawSrc = audio.getAttribute('src') ?? '';
    const src = await resolveAssetUrl(rawSrc, htmlPath);

    const audioSettings: AudioSettings = {
      autoplay: audio.closest('.exp-audio-player')?.dataset.autoplay === 'true' || false,
      loop: audio.closest('.exp-audio-player')?.dataset.loop === 'true' || false,
      playOnClick: audio.closest('.exp-audio-player')?.dataset.playOnClick === 'true' || false,
      hideControls: audio.closest('.exp-audio-player')?.dataset.hideControls === 'true' || false,
      stopOnSlideLeave: audio.closest('.exp-audio-player')?.dataset.stopOnLeave === 'true' || true,
      volume: parseFloat(audio.closest('.exp-audio-player')?.dataset.volume || '1'),
      startTime: parseFloat(audio.closest('.exp-audio-player')?.dataset.startTime || '0'),
      endTime: parseFloat(audio.closest('.exp-audio-player')?.dataset.endTime || '0'),
      playerStyle: (audio.closest('.exp-audio-player')?.dataset.playerStyle as any) || 'compact'
    };

    return {
      id, type: 'audio', content: src, style, position, transform, effects, animation,
      audio: audioSettings
    };
  }

  // Видео: сначала проверяем embed (iframe), потом локальный файл (<video>)
  const embedPlayer = contentRoot.querySelector<HTMLElement>('.exp-embed-player');
  const embedIframe = embedPlayer?.querySelector<HTMLIFrameElement>('iframe');

  if (embedPlayer && embedIframe) {
    const provider = (embedPlayer.dataset.embedProvider ?? 'custom') as EmbedProvider;
    const embedUrl = embedIframe.getAttribute('src') ?? '';

    const videoSettings: VideoSettings = {
      ...DEFAULT_VIDEO_SETTINGS,
      sourceType: 'embed',
      embedProvider: provider,
      embedUrl,
      // Если в экспорте ты добавлял data-* атрибуты — читаем их.
      // Если нет — останутся значения из DEFAULT_VIDEO_SETTINGS.
      autoplay: embedPlayer.dataset.autoplay === 'true',
      muted: embedPlayer.dataset.muted === 'true',
      loop: embedPlayer.dataset.loop === 'true',
      controls: embedPlayer.dataset.controls !== 'false',
      startTime: parseFloat(embedPlayer.dataset.startTime ?? '0') || 0,
      endTime: parseFloat(embedPlayer.dataset.endTime ?? '0') || 0
    };

    return {
      id,
      type: 'video',
      content: embedUrl,
      style,
      position,
      transform,
      effects,
      animation,
      video: videoSettings
    };
  }

  // Локальный видеофайл
  const video = contentRoot.querySelector<HTMLVideoElement>('video');
  if (video) {
    const rawSrc = video.getAttribute('src') ?? '';
    const src = await resolveAssetUrl(rawSrc, htmlPath);
    const directFilter = video.style.filter || '';
    applyDirectFilter(effects, directFilter);

    const videoSettings: VideoSettings = {
      ...DEFAULT_VIDEO_SETTINGS,
      sourceType: 'file'
    };

    return {
      id,
      type: 'video',
      content: src,
      style,
      position,
      transform,
      effects,
      animation,
      video: videoSettings
    };
  }

  // Диаграмма
  const canvas = contentRoot.querySelector<HTMLCanvasElement>('canvas[data-chart]');
  if (canvas) {
    const raw = canvas.getAttribute('data-chart') ?? '{}';
    const directFilter = canvas.style.filter || '';
    applyDirectFilter(effects, directFilter);

    const chartSettings: ChartSettings = {
      ...DEFAULT_CHART_SETTINGS,
      showDatasetLabel: canvas.dataset.showDatasetLabel !== 'false',
      datasetLabelColor: canvas.dataset.datasetLabelColor ?? DEFAULT_CHART_SETTINGS.datasetLabelColor,
      datasetLabelSize: parseFloat(canvas.dataset.datasetLabelSize ?? String(DEFAULT_CHART_SETTINGS.datasetLabelSize)) || DEFAULT_CHART_SETTINGS.datasetLabelSize,

      showLegend: canvas.dataset.showLegend !== 'false',
      legendColor: canvas.dataset.legendColor ?? DEFAULT_CHART_SETTINGS.legendColor,
      legendSize: parseFloat(canvas.dataset.legendSize ?? String(DEFAULT_CHART_SETTINGS.legendSize)) || DEFAULT_CHART_SETTINGS.legendSize,

      axisLabelColor: canvas.dataset.axisLabelColor ?? DEFAULT_CHART_SETTINGS.axisLabelColor,
      axisLabelSize: parseFloat(canvas.dataset.axisLabelSize ?? String(DEFAULT_CHART_SETTINGS.axisLabelSize)) || DEFAULT_CHART_SETTINGS.axisLabelSize,
      gridColor: canvas.dataset.gridColor ?? DEFAULT_CHART_SETTINGS.gridColor
    };

    return {
      id, type: 'chart', content: raw, style, position, transform, effects, animation,
      chart: chartSettings
    };
  }

  // Таблица
  const table = contentRoot.querySelector<HTMLTableElement>('table.exp-table')
    ?? contentRoot.querySelector<HTMLTableElement>(':scope > table');
  if (table) {
    const directFilter = table.style.filter || '';
    applyDirectFilter(effects, directFilter);

    const tableSettings: TableSettings = {
      ...DEFAULT_TABLE_SETTINGS,
      showHeader: table.dataset.showHeader !== 'false',
      headerBg: table.dataset.headerBg ?? DEFAULT_TABLE_SETTINGS.headerBg,
      headerColor: table.dataset.headerColor ?? DEFAULT_TABLE_SETTINGS.headerColor,
      cellColor: table.dataset.cellColor ?? DEFAULT_TABLE_SETTINGS.cellColor,
      borderColor: table.dataset.borderColor ?? DEFAULT_TABLE_SETTINGS.borderColor,
      borderWidth: parseFloat(table.dataset.borderWidth ?? '1') || 1,
      striped: table.dataset.striped !== 'false',
      stripeColor: table.dataset.stripeColor ?? DEFAULT_TABLE_SETTINGS.stripeColor,
      fontSize: parseFloat(table.dataset.fontSize ?? '13') || 13,
      textAlign: (table.dataset.textAlign as TableSettings['textAlign']) ?? 'left',
      paddingX: parseFloat(table.dataset.paddingX ?? '10') || 10,
      paddingY: parseFloat(table.dataset.paddingY ?? '6') || 6
    };

    return {
      id, type: 'table', content: parseTable(table), style, position, transform, effects, animation,
      table: tableSettings
    };
  }

  // Текст — .el-text
  const textEl = contentRoot.querySelector<HTMLElement>('.el-text');
  if (textEl) {
    const directFilter = textEl.style.filter || '';
    applyDirectFilter(effects, directFilter);
    const textStyle = parseTextStyle(textEl);
    return {
      id, type: 'text', content: textEl.innerHTML, style: { ...style, ...textStyle }, position, transform, effects, animation
    };
  }

  return null;
}

/**
 * Парсит CSS-длину:
 */
function parseLength(value: string, canvasSize: number): number {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed === 'auto') return 0;

  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed);
    return Number.isFinite(pct) ? (pct / 100) * canvasSize : 0;
  }

  if (trimmed.endsWith('vw') || trimmed.endsWith('vh')) {
    const v = parseFloat(trimmed);
    return Number.isFinite(v) ? (v / 100) * canvasSize : 0;
  }

  // px или просто число — как есть
  const num = parseFloat(trimmed);
  return Number.isFinite(num) ? num : 0;
}

function parsePosition(el: HTMLElement): SlideElement['position'] {
  const left = parseLength(el.style.left, CANVAS_W);
  const top = parseLength(el.style.top, CANVAS_H);
  const width = parseLength(el.style.width, CANVAS_W);
  const height = parseLength(el.style.height, CANVAS_H);

  return normalizePosition({ left, top, width, height });
}

/**
 * Страховка: если AI сгенерировал координаты в другом масштабе
 * (например, 16000×9000), нормализуем их к 1280×720.
 */
function normalizePosition(pos: {
  left: number;
  top: number;
  width: number;
  height: number;
}): SlideElement['position'] {
  const { left, top, width, height } = pos;

  const fitsCanvas =
    left >= 0 && top >= 0 &&
    left + width <= CANVAS_W * 1.2 &&
    top + height <= CANVAS_H * 1.2;

  if (fitsCanvas) {
    return {
      x: Math.round(left),
      y: Math.round(top),
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  // AI использовал другой масштаб — вычисляем коэффициент
  const scaleX = (left + width) / CANVAS_W;
  const scaleY = (top + height) / CANVAS_H;
  const k = Math.max(scaleX, scaleY, 1);

  const x = Math.round(left / k);
  const y = Math.round(top / k);
  const w = Math.round(width / k);
  const h = Math.round(height / k);

  return {
    x: Math.max(0, Math.min(x, CANVAS_W - 1)),
    y: Math.max(0, Math.min(y, CANVAS_H - 1)),
    width: Math.max(20, Math.min(w, CANVAS_W - x)),
    height: Math.max(20, Math.min(h, CANVAS_H - y))
  };
}

/**
 * Парсит стили из .element-content или .slide-element.
 * Игнорирует внутренние CSS-переменные и технические свойства.
 */
function parseStyle(el: HTMLElement): SlideElement['style'] {
  const style: SlideElement['style'] = {};
  const skip = ['position', 'left', 'top', 'width', 'height', 'contain', 'isolation', 'z-index'];

  for (const prop of Array.from(el.style)) {
    if (skip.includes(prop)) continue;
    if (prop.startsWith('--')) continue;

    const value = el.style.getPropertyValue(prop);
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

function parseContainerTransform(el: HTMLElement): ElementTransform {
  const result: ElementTransform = {};
  const t = el.style.transform || '';
  if (!t || t === 'none') return result;

  const rotateMatch = t.match(/rotate\(\s*(-?[\d.]+)deg\s*\)/);
  if (rotateMatch) {
    const deg = parseFloat(rotateMatch[1]);
    if (!Number.isNaN(deg)) result.rotation = deg;
  }

  if (/scaleX\(\s*-1\s*\)/.test(t)) result.flipX = true;
  if (/scaleY\(\s*-1\s*\)/.test(t)) result.flipY = true;

  return result;
}

function parseContentTransform(content: HTMLElement): ElementTransform {
  const result: ElementTransform = {};

  const opacity = parseFloat(content.style.opacity);
  if (!Number.isNaN(opacity) && opacity < 1) {
    result.opacity = opacity;
  }

  const blend = content.style.mixBlendMode;
  if (blend && blend !== 'normal') {
    result.blendMode = blend as ElementTransform['blendMode'];
  }

  return result;
}

function parseRadius(content: HTMLElement): Partial<ElementTransform> {
  const result: Partial<ElementTransform> = {};

  const radiusRaw = content.style.getPropertyValue('--element-radius');
  if (radiusRaw) {
    const px = parseVwToPx(radiusRaw);
    if (px > 0) result.borderRadius = px;
  }

  const clip = content.style.getPropertyValue('--element-clip-path');
  if (clip && clip.startsWith('path(')) {
    // squircle есть, но радиус потерян — восстанавливаем приблизительно
    if (!result.borderRadius) result.borderRadius = 20;
    // cornerSmoothing точно не восстановить — оставляем 0 или эвристику
  }

  return result;
}

function parseBackdrop(el: HTMLElement): ElementEffects {
  const effects: ElementEffects = {};

  const backdrop = el.querySelector<HTMLElement>(':scope > .element-backdrop');
  if (!backdrop) return effects;

  const filter = backdrop.style.backdropFilter || backdrop.style.getPropertyValue('-webkit-backdrop-filter');
  if (filter && filter !== 'none') {
    const blurMatch = filter.match(/blur\(\s*([\d.]+)px\s*\)/);
    const blurRadius = blurMatch ? parseFloat(blurMatch[1]) : 0;

    if (blurRadius > 0) {
      effects.backdropBlur = {
        enabled: true,
        radius: blurRadius
      };
    }
  }

  return effects;
}

async function parseMaskedMedia(
  slideElement: HTMLElement,
  contentRoot: HTMLElement,
  base: {
    style: SlideElement['style'];
    position: SlideElement['position'];
    transform: ElementTransform;
    effects: ElementEffects;
    animation?: SlideElement['animation'];
  },
  htmlPath: string
): Promise<SlideElement[] | null> {
  // Ищем SVG, внутри которого есть <clipPath>
  const svg = contentRoot.querySelector<SVGSVGElement>('svg');
  if (!svg) return null;

  const clipPath = svg.querySelector<SVGClipPathElement>('clipPath');
  if (!clipPath) return null;

  const pathEl = clipPath.querySelector<SVGPathElement>('path');
  const maskPath = pathEl?.getAttribute('d') ?? '';
  if (!maskPath) return null;

  const clipId = clipPath.getAttribute('id') ?? '';
  if (!clipId) return null;

  // Ищем target — элемент, к которому применён clip-path
  const target =
    svg.querySelector<SVGElement>(`foreignObject[clip-path*="${clipId}"]`) ??
    svg.querySelector<SVGElement>(`image[clip-path*="${clipId}"]`) ??
    svg.querySelector<SVGElement>(`[clip-path*="${clipId}"]`);

  if (!target) return null;

  // Внутри target — либо <img> (в foreignObject), либо <image>, либо <video>
  const innerImg =
    target.querySelector<HTMLImageElement>('img') ??
    target.querySelector<SVGImageElement>('image');
  const innerVideo = target.querySelector<HTMLVideoElement>('video');

  const rawSrc =
    (innerImg as HTMLImageElement | SVGImageElement | null)?.getAttribute?.('src') ??
    (innerImg as SVGImageElement | null)?.getAttribute?.('href') ??
    innerVideo?.getAttribute('src') ??
    '';

  if (!rawSrc) return null;

  const src = await resolveAssetUrl(rawSrc, htmlPath);
  if (!src) return null;

  const mediaId = crypto.randomUUID();

  const maskData = contentRoot.closest<HTMLElement>('[data-mask-path]')?.dataset;

  const maskPathFromData = slideElement.dataset.maskPath;
  const maskPosFromData = slideElement.dataset.maskPosition;
  const maskRotFromData = slideElement.dataset.maskRotation;
  const maskIdFromData = slideElement.dataset.maskId;
  const maskKindFromData = slideElement.dataset.maskKind;

  const maskPosition = maskPosFromData
    ? (() => {
        const [x, y, w, h] = maskPosFromData.split(',').map(Number);
        return { x, y, width: w, height: h };
      })()
    : { ...base.position }; // fallback — позиция картинки

  const maskRotation = maskRotFromData ? parseFloat(maskRotFromData) : 0;

  const maskShape: SlideElement = {
    id: maskIdFromData ?? crypto.randomUUID(),
    type: 'shape',
    content: '',
    shape: {
      kind: (maskKindFromData as any) ?? 'rect',
      customPath: maskPathFromData ?? maskPath,
      maskTargetId: mediaId
    },
    style: { fill: 'none', stroke: 'none', strokeWidth: 0 },
    position: maskPosition,
    transform: maskRotation ? { rotation: maskRotation } : {},
    effects: {},
    animation: undefined
  };

  if (innerVideo) {
    return [
      maskShape,
      {
        id: mediaId,
        type: 'video',
        content: src,
        style: base.style,
        position: base.position,
        transform: base.transform,
        effects: base.effects,
        animation: base.animation,
        video: { ...DEFAULT_VIDEO_SETTINGS, sourceType: 'file' }
      }
    ];
  }

  if (innerImg) {
    return [
      maskShape,
      {
        id: mediaId,
        type: 'image',
        content: src,
        style: base.style,
        position: base.position,
        transform: base.transform,
        effects: base.effects,
        animation: base.animation
      }
    ];
  }

  return null;
}

/**
 * Парсит CSS-переменные эффектов из inline-стиля .element-content.
 */
function parseEffects(el: HTMLElement): ElementEffects {
  const effects: ElementEffects = {};

  const filterRaw = el.style.getPropertyValue('--element-filter') || '';
  const innerRaw = el.style.getPropertyValue('--inner-shadow') || '';

  if (filterRaw) {
    // drop-shadow(x y blur color)
    const ds = filterRaw.match(/drop-shadow\(\s*(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(.+?)\)(?:\s|$)/);
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

    // blur(Npx)
    const bl = filterRaw.match(/blur\(\s*([\d.]+)px\s*\)/);
    if (bl) {
      effects.blur = {
        enabled: true,
        radius: parseFloat(bl[1])
      };
    }
  }

  if (innerRaw) {
    // inset x y blur spread color
    const im = innerRaw.match(/inset\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(.+)/);
    if (im) {
      effects.innerShadow = {
        enabled: true,
        x: parseFloat(im[1]),
        y: parseFloat(im[2]),
        blur: parseFloat(im[3]),
        spread: parseFloat(im[4]),
        color: im[5].trim()
      };
    }
  }

  return effects;
}

/**
 * Парсит стили из .element-content — отфильтровывает внутренние CSS-переменные
 * и технические свойства.
 */
function parseStyleFromContent(el: HTMLElement): SlideElement['style'] {
  const style: SlideElement['style'] = {};
  const skip = [
    'position', 'left', 'top', 'width', 'height', 'contain', 'isolation',
    'z-index', 'overflow', 'display'
  ];

  for (const prop of Array.from(el.style)) {
    if (skip.includes(prop)) continue;
    if (prop.startsWith('--')) continue;

    const value = el.style.getPropertyValue(prop);
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

/**
 * Парсит SVG-фильтр внутренней тени из <defs>.
 * Используется для фигур (ShapeView) и для картинок (MediaView).
 */
function parseSvgInnerShadow(
  svgEl: SVGSVGElement
): ElementEffects['innerShadow'] | null {
  // Ищем любой <path> или <image> с filter="url(#...)"
  const targetWithFilter = svgEl.querySelector<SVGElement>(
    'path[filter], image[filter], foreignObject[filter]'
  );
  if (!targetWithFilter) return null;

  const filterAttr = targetWithFilter.getAttribute('filter') ?? '';
  const idMatch = filterAttr.match(/url\(#([^)]+)\)/);
  if (!idMatch) return null;

  const filterId = idMatch[1];
  const filterEl = svgEl.querySelector(`#${filterId}`) as SVGFilterElement | null;
  if (!filterEl) return null;

  const blurEl = filterEl.querySelector('feGaussianBlur');
  const stdDev = parseFloat(blurEl?.getAttribute('stdDeviation') ?? '0');
  const blur = stdDev * 2;

  const offsetEl = filterEl.querySelector('feOffset');
  const dx = parseFloat(offsetEl?.getAttribute('dx') ?? '0');
  const dy = parseFloat(offsetEl?.getAttribute('dy') ?? '0');

  const floodEl = filterEl.querySelector('feFlood');
  const color = floodEl?.getAttribute('flood-color') ?? '#000000';
  const opacity = parseFloat(floodEl?.getAttribute('flood-opacity') ?? '1');

  return {
    enabled: true,
    x: dx,
    y: dy,
    blur: Number.isNaN(blur) ? 12 : blur,
    spread: 0,
    color: toRgba(color, Number.isNaN(opacity) ? 1 : opacity)
  };
}

/**
 * Добавляет drop-shadow и blur из filter-строки в effects, если ещё не заданы.
 */
function applyDirectFilter(effects: ElementEffects, filter: string): void {
  if (!filter) return;

  if (!effects.dropShadow) {
    const ds = filter.match(/drop-shadow\(\s*(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([^)]+)\)/);
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
  }

  if (!effects.blur) {
    const bl = filter.match(/blur\(\s*([\d.]+)px\s*\)/);
    if (bl) {
      effects.blur = { enabled: true, radius: parseFloat(bl[1]) };
    }
  }
}

/**
 * Преобразует цвет + opacity в rgba-строку.
 */
function toRgba(color: string, opacity: number): string {
  if (color.startsWith('rgba')) return color;
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
  }
  if (color.startsWith('#')) {
    let h = color.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) || 0;
    const g = parseInt(h.slice(2, 4), 16) || 0;
    const b = parseInt(h.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
}

/**
 * Читает data-background и превращает data: URL картинки в blob: URL.
 */
async function parseBackgroundAsync(
  section: HTMLElement
): Promise<SlideBackground | undefined> {
  // 1. Пробуем прочитать из data-background
  const raw = section.dataset.background;
  let parsed: SlideBackground | undefined;

  if (raw && raw !== 'null' && raw !== 'undefined') {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') {
        parsed = p as SlideBackground;
      }
    } catch {
      /* ignore */
    }
  }

  // 2. Если фон — картинка, достаём её из inline-стиля section
  if (parsed?.type === 'image') {
    const bgImage = parseBackgroundImageUrl(section);
    if (bgImage) {
      // bgImage — это либо data: URL, либо относительный путь, либо URL
      parsed.imageUrl = await resolveBackgroundImage(bgImage, section);
    } else if (parsed.imageUrl) {
      // Fallback: если в data-background есть URL, пробуем его
      parsed.imageUrl = await resolveBackgroundImage(parsed.imageUrl, section);
    }
  }

  return parsed;
}

/**
 * Извлекает URL картинки из inline background-image: url(...) на section.
 */
function parseBackgroundImageUrl(section: HTMLElement): string | null {
  const bg = section.style.backgroundImage;
  if (!bg || bg === 'none') return null;
  const m = bg.match(/url\(['"]?([^'")]+)['"]?\)/);
  return m ? m[1] : null;
}

/**
 * Разрешает URL картинки фона: data: → blob:, относительный путь не трогаем
 * (он уже blob: в редакторе), http/https оставляем.
 */
async function resolveBackgroundImage(
  src: string,
  section: HTMLElement
): Promise<string> {
  if (!src) return '';
  if (src.startsWith('blob:')) return src;
  if (src.startsWith('data:')) return await dataUrlToBlobUrl(src);
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  // Относительный путь из экспорта — но экспорт обычно вшивает data: URL
  return src;
}

function parseTable(table: HTMLTableElement): string {
  const headers: string[] = [];
  const rows: string[][] = [];

  table.querySelectorAll('thead th').forEach(th => {
    headers.push(th.textContent?.trim() ?? '');
  });

  table.querySelectorAll('tbody tr').forEach(tr => {
    const cells: string[] = [];
    tr.querySelectorAll('td').forEach(td => {
      cells.push(td.textContent?.trim() ?? '');
    });
    rows.push(cells);
  });

  return JSON.stringify({ headers, rows });
}

/**
 * Парсит стили текста с .el-text.
 * font-size переводится из vw в px канваса.
 */
function parseTextStyle(el: HTMLElement): SlideElement['style'] {
  const style: SlideElement['style'] = {};

  const fontFamily = el.style.fontFamily;
  if (fontFamily) {
    // убираем fallback: 'Arial', sans-serif → 'Arial'
    const first = fontFamily.split(',')[0].trim();
    style.fontFamily = first.replace(/^['"]|['"]$/g, '');
  }

  const fontSize = el.style.fontSize;
  if (fontSize) {
    style.fontSize = convertSizeToPx(fontSize);
  }

  const fontWeight = el.style.fontWeight;
  if (fontWeight) style.fontWeight = fontWeight;

  const fontStyle = el.style.fontStyle;
  if (fontStyle) style.fontStyle = fontStyle;

  const color = el.style.color;
  if (color) style.color = color;

  const textAlign = el.style.textAlign;
  if (textAlign) style.textAlign = textAlign as any;

  style.fontStyleName = styleToName(style.fontWeight, style.fontStyle);

  return style;
}

/**
 * Конвертирует размер из vw в px канваса.
 * Если значение уже в px — возвращает как есть.
 * 1vw = 1% ширины слайда = CANVAS_W / 100 px.
 */
function convertSizeToPx(value: string): string {
  const vwMatch = value.match(/^([\d.]+)vw$/);
  if (vwMatch) {
    const px = Math.round((parseFloat(vwMatch[1]) / 100) * CANVAS_W);
    return `${px}px`;
  }
  // px, em, rem — оставляем как есть
  return value;
}

function styleToName(weight: string | undefined, style: string | undefined): string {
  const w = String(weight ?? '400');
  const s = String(style ?? 'normal');

  let name = 'Regular';

  if (w === '700' || w === 'bold') name = 'Bold';
  else if (w === '600') name = 'SemiBold';
  else if (w === '500') name = 'Medium';
  else if (w === '300') name = 'Light';
  else if (w === '200') name = 'ExtraLight';
  else if (w === '100') name = 'Thin';
  else if (w === '800') name = 'ExtraBold';
  else if (w === '900') name = 'Black';

  if (s === 'italic') {
    name = name === 'Regular' ? 'Italic' : `${name} Italic`;
  } else if (s === 'oblique') {
    name = name === 'Regular' ? 'Oblique' : `${name} Oblique`;
  }

  return name;
}

async function resolveAssetUrl(src: string, htmlPath: string): Promise<string> {
  if (!src) return '';

  if (src.startsWith('data:')) {
    return dataUrlToBlobUrl(src);
  }

  if (src.startsWith('blob:')) {
    return src;
  }

  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }

  let relative = src;
  if (src.startsWith('file://')) {
    const absolute = decodeURIComponent(src.replace('file://', ''));
    const normalized = /^\/[A-Za-z]:/.test(absolute) ? absolute.slice(1) : absolute;
    const dir = await dirname(htmlPath);
    if (normalized.startsWith(dir)) {
      relative = normalized.slice(dir.length).replace(/^[\\/]/, '');
    } else {
      return await readFileAsBlobUrl(normalized);
    }
  }

  try {
    const dir = await dirname(htmlPath);
    const assetPath = await join(dir, relative);
    return await readFileAsBlobUrl(assetPath);
  } catch {
    return '';
  }
}

async function readFileAsBlobUrl(absolutePath: string): Promise<string> {
  const existsFlag = await exists(absolutePath);
  if (!existsFlag) {
    return '';
  }
  const bytes = await readFile(absolutePath);
  const blob = new Blob([bytes], { type: guessMime(absolutePath) });
  return URL.createObjectURL(blob);
}

async function dataUrlToBlobUrl(dataUrl: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function guessMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    webm: 'video/webm'
  };
  return map[ext] ?? 'application/octet-stream';
}

function emptySlide(index: number): Slide {
  return {
    id: crypto.randomUUID(),
    title: `Слайд ${index + 1}`,
    elements: [],
    transition: 'fade',
    transitionDuration: 700
  };
}

function parseTableSettings(table: HTMLTableElement): TableSettings {
  const s = { ...DEFAULT_TABLE_SETTINGS };
  s.showHeader = table.dataset.showHeader !== 'false';
  s.headerBg = table.dataset.headerBg ?? s.headerBg;
  s.headerColor = table.dataset.headerColor ?? s.headerColor;
  s.cellColor = table.dataset.cellColor ?? s.cellColor;
  s.borderColor = table.dataset.borderColor ?? s.borderColor;
  s.borderWidth = parseLength(table.dataset.borderWidth ?? '1px', CANVAS_W);
  s.striped = table.dataset.striped !== 'false';
  s.stripeColor = table.dataset.stripeColor ?? s.stripeColor;
  s.fontSize = parseLength(table.dataset.fontSize ?? '16px', CANVAS_W);
  s.textAlign = (table.dataset.textAlign as any) ?? s.textAlign;
  s.paddingX = parseLength(table.dataset.paddingX ?? '10px', CANVAS_W);
  s.paddingY = parseLength(table.dataset.paddingY ?? '6px', CANVAS_H);
  return s;
}

function parseContentEffects(content: HTMLElement): ElementEffects {
  const effects: ElementEffects = {};
  const style = content.style;

  // ---------- drop-shadow + blur ----------
  // Собираем всё, что может содержать drop-shadow: --element-filter, filter
  const filterRaw =
    style.getPropertyValue('--element-filter') ||
    style.filter ||
    '';

  if (filterRaw && filterRaw !== 'none') {
    // drop-shadow(x y blur color)
    const ds = filterRaw.match(
      /drop-shadow\(\s*(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+((?:rgba?|hsla?)\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\s*\)/
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

    // blur(Npx) — без drop-shadow
    const bl = filterRaw.match(/(?:^|\s)blur\(\s*([\d.]+)px\s*\)/);
    if (bl) {
      effects.blur = {
        enabled: true,
        radius: parseFloat(bl[1])
      };
    }
  }

  // ---------- inner-shadow ----------
  // Собираем из --inner-shadow или box-shadow
  const innerRaw =
    style.getPropertyValue('--inner-shadow') ||
    style.boxShadow ||
    '';

  if (innerRaw && innerRaw !== 'none' && innerRaw.includes('inset')) {
    // inset x y blur spread color
    const im = innerRaw.match(
      /inset\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(.+?)(?:;|$)/
    );
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

export function parseNewElement(node: HTMLElement): SlideElement | null {
  const type = node.dataset.type as SlideElement['type'] | undefined;
  if (!type) return null;

  const position = parsePosition(node);
  const content = node.querySelector<HTMLElement>(':scope > .element-content');
  const style = content ? parseStyleFromContent(content) : {};
  const transform = content ? parseContentTransform(content) : {};
  const effects = content ? parseContentEffects(content) : {};

  const contentRoot = content ?? node;

  // Определяем контент по типу
  let content_value = '';

  if (type === 'text') {
    const textEl = contentRoot.querySelector<HTMLElement>('.el-text');
    if (textEl) {
      content_value = textEl.innerHTML;
      Object.assign(style, parseTextStyle(textEl));
    }
  } else if (type === 'image') {
    const img = contentRoot.querySelector<HTMLImageElement>('img');
    if (img) content_value = img.getAttribute('src') ?? '';
  } else if (type === 'table') {
    const table = contentRoot.querySelector<HTMLTableElement>('table.exp-table, table');
    if (table) {
      content_value = parseTable(table);
      // Настройки таблицы
      const tableSettings = parseTableSettings(table);
      return {
        id: crypto.randomUUID(),
        type: 'table',
        content: content_value,
        style,
        position,
        transform,
        effects,
        table: tableSettings
      };
    }
  } else if (type === 'chart') {
    const canvas = contentRoot.querySelector<HTMLCanvasElement>('canvas[data-chart]');
    if (canvas) content_value = canvas.getAttribute('data-chart') ?? '{}';
  } else if (type === 'shape') {
    const pathEl = contentRoot.querySelector<SVGPathElement>('path');
    if (pathEl) {
      const path = pathEl.getAttribute('d') ?? '';
      const fill = pathEl.getAttribute('fill') ?? '#7c6cf0';
      const stroke = pathEl.getAttribute('stroke') ?? 'none';
      const strokeWidth = parseFloat(pathEl.getAttribute('stroke-width') ?? '0') || 0;

      return {
        id: crypto.randomUUID(),
        type: 'shape',
        content: '',
        shape: { kind: 'rect', customPath: path },
        style: { fill, stroke, strokeWidth },
        position,
        transform,
        effects
      };
    }
  }

  return {
    id: crypto.randomUUID(),
    type,
    content: content_value,
    style,
    position,
    transform,
    effects
  };
}
