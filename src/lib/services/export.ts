import { CANVAS_H, CANVAS_W } from '$lib/stores/app.svelte';
import { DEFAULT_CHART_SETTINGS, DEFAULT_TABLE_SETTINGS, DEFAULT_VIDEO_SETTINGS, type Slide, type SlideElement } from '$lib/stores/presentation.svelte';
import { animationClass, animationStyle } from './animations';
import { escapeAttr, escapeHtml } from './common';
import { buildSvgInnerShadowFilter, splitElementStyles } from './element-effects';
import { fonts, type FontFileData } from './fonts.svelte';
import { getShapePath, SHAPES } from './shapes';
import { backgroundToStyle } from './slide-backgrounds';
import { squirclePath } from '$lib/services/squircle';
import { embedAllow, parseEmbedUrl } from './video-embed';

export interface ExportAsset {
  relativePath: string;
  blob: Blob;
}

export interface BuiltExport {
  html: string;
  assets: ExportAsset[];
}

export interface BuildExportOptions {
  inlineAssets?: boolean;
  startSlideIndex?: number;
}

function findMaskShapeFor(
  targetId: string,
  allSlides: Slide[]
): SlideElement | null {
  for (const slide of allSlides) {
    for (const el of slide.elements) {
      if (el.type === 'shape' && el.shape?.maskTargetId === targetId) {
        return el;
      }
    }
  }
  return null;
}

async function imageToBase64(src: string): Promise<string> {
  if (src.startsWith('data:')) return src;
  const res = await fetch(src);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function buildExport(
  slides: Slide[],
  projectName: string,
  options: BuildExportOptions = {}
): Promise<BuiltExport> {
  const { inlineAssets = false } = options;
  const assets: ExportAsset[] = [];
  const hasCharts = slides.some(slide =>
    slide.elements.some(el => el.type === 'chart')
  );
  const chartSource = hasCharts
    ? await fetch('/chart.umd.js').then(r => r.text())
    : '';
  const urlMap = new Map<string, string>();

  const slidesHtml: string[] = [];
  const fontFaces = await buildFontFaces(slides, inlineAssets, assets);

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const elementsHtml: string[] = [];

    for (const el of slide.elements) {
      if ((el.style as any)?.hidden) continue;
      const html = await renderElement(el, i, slides, urlMap, assets, inlineAssets);
      if (html) elementsHtml.push(html);
    }

    let bgStyle = '';
    if (slide.background) {
      if (slide.background.type === 'image' && slide.background.imageUrl) {
        const base64 = await imageToBase64(slide.background.imageUrl);
        const fit = slide.background.imageFit ?? 'cover';
        const size = fit === 'contain' ? 'contain' : fit === 'repeat' ? 'auto' : 'cover';
        const repeat = fit === 'repeat' ? 'repeat' : 'no-repeat';
        bgStyle = `background-image:url('${base64}');background-position:center;background-size:${size};background-repeat:${repeat};`;
      } else {
        bgStyle = backgroundToStyle(slide.background);
      }
    }

    slidesHtml.push(
      `<section
        class="slide"
        data-title="${escapeAttr(slide.title || '')}"
        data-transition="${escapeAttr(slide.transition)}"
        data-background="${escapeAttr(JSON.stringify(slide.background ?? null))}"
        style="--transition-duration: ${slide.transitionDuration ?? 700}ms; ${bgStyle}"
        id="slide-${i + 1}"
      >
      <div class="slide-inner">
        ${elementsHtml.join('\n    ')}
      </div>
    </section>`
    );
  }

  const startSlide = Math.max(0, options.startSlideIndex ?? 0);
  const title = escapeHtml(projectName);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  ${fontFaces}
  ${EXPORT_CSS}
</style>
<script>window.__START_SLIDE__ = ${startSlide};</script>
</head>
<body>
<div class="presentation">
${slidesHtml.join('\n')}
</div>
<nav class="nav">
  <button id="prev" aria-label="Назад">‹</button>
  <span id="counter">1 / ${slides.length}</span>
  <button id="next" aria-label="Вперёд">›</button>
</nav>
<script>
  ${chartSource}
  ${EXPORT_JS}
<\/script>
</body>
</html>`;

  return { html, assets };
}

// ---------- Внутренние ----------
function normalizePath(path: string, size = 100) {
  return path.replace(/-?\d*\.?\d+(e[-+]?\d+)?/gi, (m) => {
    const n = parseFloat(m);
    return String(n / size);
  });
}

function buildMaskBoxStyle(maskShape: SlideElement) {
  // Позиция и размеры — от маски
  const pos = maskShape.position;
  const left   = (pos.x / CANVAS_W) * 100;
  const top    = (pos.y / CANVAS_H) * 100;
  const width  = (pos.width / CANVAS_W) * 100;
  const height = (pos.height / CANVAS_H) * 100;

  return [
    'position:absolute',
    `left:${left.toFixed(3)}%`,
    `top:${top.toFixed(3)}%`,
    `width:${width.toFixed(3)}%`,
    `height:${height.toFixed(3)}%`
  ].join(';') + ';';
}

function wrapElement(
  el: SlideElement,
  innerHtml: string,
  basePositionStyle: string,
  extraAttrs = ''
): string {
  const split = splitElementStyles(el, {
    unit: 'vw',
    canvasWidth: CANVAS_W,
    disableSquircle: true
  });

  const needsShapeMask =
    el.type === 'shape' &&
    Boolean(el.effects?.backdropBlur?.enabled);

  const backdropMaskStyle = needsShapeMask
    ? `-webkit-mask-image:url('#shape-mask-${el.id}');` +
      `mask-image:url('#shape-mask-${el.id}');` +
      `-webkit-mask-repeat:no-repeat;` +
      `mask-repeat:no-repeat;`
    : '';

  const animClass = animationClass(el.animation);
  const animStyle = animationStyle(el.animation);
  const animAttr = el.animation && el.animation.kind !== 'none' ? `data-anim="${el.animation.kind}" data-trigger="${el.animation.trigger}"` : '';

  const backdropHtml = split.backdrop
    ? `<div class="element-backdrop" style="${split.backdrop};${backdropMaskStyle}"></div>`
    : '';
  const contentHtml = split.content
    ? `<div class="element-content" style="${split.content};">${innerHtml}</div>`
    : `<div class="element-content">${innerHtml}</div>`;

  return `<div class="slide-element ${animClass}" ${animAttr}${extraAttrs} style="${basePositionStyle}; ${split.container}; ${animStyle};">
  ${backdropHtml}
  ${contentHtml}
</div>`;
}

/**
 * Рендерит картинку с внутренней тенью по alpha-каналу через SVG-фильтр.
 * Используется, когда у элемента активна внутренняя тень.
 * Иначе возвращает обычный <img>.
 */
function renderImageWithInnerShadow(
  el: SlideElement,
  src: string,
  filterId: string
): string {
  const w = el.position.width;
  const h = el.position.height;
  const filterSvg = buildSvgInnerShadowFilter(el, filterId);

  const radius = el.transform?.borderRadius ?? 0;
  const smoothing = el.transform?.cornerSmoothing ?? 0;
  const clipId = `img-clip-${el.id}`;
  const needsClip = radius > 0;

  let squirclePathData = '';
  if (needsClip && smoothing > 0) {
    squirclePathData = squirclePath({
      width: w,
      height: h,
      cornerRadius: radius,
      cornerSmoothing: smoothing / 100
    });
  }

  const clipPathDef = needsClip
    ? `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">
        ${squirclePathData ? `<path d="${squirclePathData}" />` : `<rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" />`}
      </clipPath>`
    : '';

  const clipPathAttr = needsClip ? `clip-path="url(#${clipId})"` : '';

  return `<svg
    class="media-svg"
    viewBox="0 0 ${w} ${h}"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      ${filterSvg}
      ${clipPathDef}
    </defs>
    <foreignObject x="0" y="0" width="${w}" height="${h}" filter="url(#${filterId})" ${clipPathAttr}>
      <img
        xmlns="http://www.w3.org/1999/xhtml"
        src="${src}"
        alt=""
        style="width:100%;height:100%;object-fit:contain;display:block;"
      />
    </foreignObject>
  </svg>`;
}

function buildTextStyle(style: Record<string, any> | undefined): string {
  if (!style) return '';
  const parts: string[] = [];

  if (style.fontFamily) parts.push(`font-family: '${style.fontFamily}', sans-serif`);
  if (style.fontWeight) parts.push(`font-weight: ${style.fontWeight}`);
  if (style.fontStyle) parts.push(`font-style: ${style.fontStyle}`);
  if (style.fontSize) parts.push(`font-size: ${pxToVw(style.fontSize)}`);
  if (style.color) parts.push(`color: ${style.color}`);
  if (style.textAlign) parts.push(`text-align: ${style.textAlign}`);

  return parts.join('; ');
}

async function renderElement(
  el: SlideElement,
  slideIndex: number,
  allSlides: Slide[],
  urlMap: Map<string, string>,
  assets: ExportAsset[],
  inlineAssets: boolean
): Promise<string> {
  const style = buildStyle(el);
  let inner = '';

  switch (el.type) {
    case 'text':
      const textStyle = buildTextStyle(el.style);
      inner = `<div class="el-text" style="${textStyle}">${el.content}</div>`;
      break;

    case 'image': {
      const src = await resolveAsset(el.content, 'images', urlMap, assets, 'png', inlineAssets);
      const maskShape = findMaskShapeFor(el.id, allSlides);

      if (maskShape) {
        const maskPath =
          maskShape.shape?.customPath ??
          getShapePath(maskShape.shape?.kind ?? 'rect');

        const clipId = `clip${maskShape.id.replace(/[^a-zA-Z0-9]/g, '')}`;

        const maskDataAttrs =
          ` data-mask-id="${escapeAttr(maskShape.id)}"` +
          ` data-mask-path="${escapeAttr(maskPath)}"` +
          ` data-mask-position="${maskShape.position.x},${maskShape.position.y},${maskShape.position.width},${maskShape.position.height}"` +
          ` data-mask-rotation="${maskShape.transform?.rotation ?? 0}"` +
          ` data-mask-kind="${escapeAttr(maskShape.shape?.kind ?? 'rect')}"` +
          ` data-mask-fill="${escapeAttr(maskShape.style?.fill ?? '')}"` +
          ` data-mask-stroke="${escapeAttr(maskShape.style?.stroke ?? '')}"` +
          ` data-mask-stroke-width="${maskShape.style?.strokeWidth ?? 0}"`;

        const mw = maskShape.position.width;
        const mh = maskShape.position.height;

        inner = `<svg
          viewBox="0 0 ${mw} ${mh}"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          style="position:absolute;inset:0;width:100%;height:100%;display:block;"
        >
          <defs>
            <clipPath clipPathUnits="userSpaceOnUse" id="${clipId}">
              <path d="${maskPath}" transform="scale(${mw / 100}, ${mh / 100})" />
            </clipPath>
          </defs>
          <g clip-path="url(#${clipId})">
            <foreignObject x="0" y="0" width="${mw}" height="${mh}">
              <img
                xmlns="http://www.w3.org/1999/xhtml"
                src="${src}"
                alt=""
                style="width:100%;height:100%;object-fit:cover;display:block;"
              />
            </foreignObject>
          </g>
        </svg>`;

        const maskStyle = buildMaskBoxStyle(maskShape);

        return wrapElement(
          {
            ...el,
            transform: {
              ...maskShape.transform,
              outlineWidth: 0,
              outlineColor: undefined,
              borderRadius: 0,
              cornerSmoothing: 0
            }
          },
          inner,
          maskStyle,
          maskDataAttrs
        );
      }

      // Обычная картинка
      const hasInnerShadow = Boolean(el.effects?.innerShadow?.enabled);

      if (hasInnerShadow) {
        // Внутренняя тень по alpha-каналу через SVG-фильтр
        const filterId = `img-inner-shadow-${el.id}`;
        inner = `<div class="media-wrapper">${renderImageWithInnerShadow(el, src, filterId)}</div>`;
      } else {
        // Обычный <img> с внешней тенью через CSS
        inner = `<div class="media-wrapper"><img src="${src}" alt="" /></div>`;
      }
      break;
    }

    case 'audio': {
      const src = await resolveAsset(el.content, 'audio', urlMap, assets, 'mp3', inlineAssets);

      const settings = {
        autoplay: false,
        loop: false,
        playOnClick: false,
        hideControls: false,
        stopOnSlideLeave: true,
        volume: 1,
        startTime: 0,
        endTime: 0,
        playerStyle: 'compact',
        ...(el.audio ?? {})
      };

      const dataAttrs = [
        `data-autoplay="${settings.autoplay}"`,
        `data-loop="${settings.loop}"`,
        `data-play-on-click="${settings.playOnClick}"`,
        `data-hide-controls="${settings.hideControls}"`,
        `data-stop-on-leave="${settings.stopOnSlideLeave}"`,
        `data-volume="${settings.volume}"`,
        `data-start-time="${settings.startTime}"`,
        `data-end-time="${settings.endTime}"`,
        `data-player-style="${settings.playerStyle}"`
      ].join(' ');

      let controlsHtml = '';

      if (!settings.hideControls) {
        const playBtn = `<button type="button" class="exp-audio-play" aria-label="Play">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>`;

        const progressBar = `<div class="exp-audio-progress"><div class="exp-audio-fill"></div></div>`;

        const timeEl = `<span class="exp-audio-time">0:00</span>`;

        const volumeControl = `<div class="exp-audio-volume">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
          <input type="range" min="0" max="1" step="0.05" value="${settings.volume}" />
        </div>`;

        if (settings.playerStyle === 'minimal') {
          controlsHtml = playBtn + progressBar;
        } else if (settings.playerStyle === 'full') {
          controlsHtml = playBtn + progressBar + timeEl + volumeControl;
        } else {
          controlsHtml = playBtn + progressBar + timeEl;
        }
      }

      inner = `<div class="exp-audio-player" ${dataAttrs}>
        <audio src="${src}" preload="metadata"></audio>
        ${controlsHtml}
      </div>`;
      break;
    }

    case 'video': {
      const settings = { ...DEFAULT_VIDEO_SETTINGS, ...(el.video ?? {}) };

      // ---------- Embed-видео (YouTube, Rutube, VK, Dzen, custom) ----------
      if (settings.sourceType === 'embed' && settings.embedUrl) {
        const info = parseEmbedUrl(settings.embedUrl);
        if (!info) {
          inner = '';
          break;
        }

        const params: string[] = [];
        if (settings.autoplay) params.push('autoplay=1');
        if (settings.muted) params.push('mute=1');
        if (settings.loop) {
          params.push('loop=1');
          if (info.provider === 'youtube') params.push(`playlist=${info.id}`);
        }
        if (settings.startTime > 0) params.push(`start=${Math.round(settings.startTime)}`);
        if (settings.endTime > 0) params.push(`end=${Math.round(settings.endTime)}`);
        if (settings.controls === false && info.provider === 'youtube') {
          params.push('controls=0');
        }

        const finalUrl = params.length
          ? `${info.embedUrl}${info.embedUrl.includes('?') ? '&' : '?'}${params.join('&')}`
          : info.embedUrl;

        inner = `<div class="exp-embed-player" data-embed-provider="${info.provider}">
          <iframe
            src="${finalUrl}"
            title="Video player"
            frameborder="0"
            allow="${embedAllow(info.provider)}"
            allowfullscreen
            loading="lazy"
          ></iframe>
        </div>`;
        break;
      }

      // ---------- Локальный файл ----------
      // ВАЖНО: resolveAsset вызывается здесь — именно этот вызов кладёт файл в assets/video/
      const src = await resolveAsset(el.content, 'video', urlMap, assets, 'mp4', inlineAssets);
      if (!src) {
        inner = '';
        break;
      }

      const maskShape = findMaskShapeFor(el.id, allSlides);

      if (maskShape) {
        const maskPath =
          maskShape.shape?.customPath ??
          getShapePath(maskShape.shape?.kind ?? 'rect');

        const clipId = `clip${maskShape.id.replace(/[^a-zA-Z0-9]/g, '')}`;

        const maskDataAttrs =
          ` data-mask-id="${escapeAttr(maskShape.id)}"` +
          ` data-mask-path="${escapeAttr(maskPath)}"` +
          ` data-mask-position="${maskShape.position.x},${maskShape.position.y},${maskShape.position.width},${maskShape.position.height}"` +
          ` data-mask-rotation="${maskShape.transform?.rotation ?? 0}"` +
          ` data-mask-kind="${escapeAttr(maskShape.shape?.kind ?? 'rect')}"`;

        const mw = maskShape.position.width;
        const mh = maskShape.position.height;

        inner = `<svg
          viewBox="0 0 ${mw} ${mh}"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          style="position:absolute;inset:0;width:100%;height:100%;display:block;"
        >
          <defs>
            <clipPath clipPathUnits="userSpaceOnUse" id="${clipId}">
              <path d="${maskPath}" transform="scale(${mw / 100}, ${mh / 100})" />
            </clipPath>
          </defs>
          <g clip-path="url(#${clipId})">
            <foreignObject x="0" y="0" width="${mw}" height="${mh}">
              <video
              xmlns="http://www.w3.org/1999/xhtml"
              src="${src}"
              playsinline
              preload="auto"
              data-volume="${settings.volume}"
              data-muted="${settings.muted}"
              data-loop="${settings.loop}"
              data-autoplay="${settings.autoplay}"
              data-start-time="${settings.startTime}"
              data-end-time="${settings.endTime}"
              data-controls="${settings.controls}"
              data-play-on-click="${settings.playOnClick}"
              data-stop-on-leave="${settings.stopOnSlideLeave}"
              style="width:100%;height:100%;object-fit:cover;display:block;"
              ></video>
            </foreignObject>
          </g>
        </svg>`;

        const maskStyle = buildMaskBoxStyle(maskShape);

        return wrapElement(
          {
            ...el,
            transform: {
              ...maskShape.transform,
              outlineWidth: 0,
              outlineColor: undefined,
              borderRadius: 0,
              cornerSmoothing: 0
            }
          },
          inner,
          maskStyle,
          maskDataAttrs
        );
      }

      const hasInnerShadow = Boolean(el.effects?.innerShadow?.enabled);

      // Собираем HTML для кастомного плеера как в VideoPlayer.svelte
      const dataAttrs = [
        `data-autoplay="${settings.autoplay}"`,
        `data-loop="${settings.loop}"`,
        `data-muted="${settings.muted}"`,
        `data-controls="${settings.controls}"`,
        `data-play-on-click="${settings.playOnClick}"`,
        `data-stop-on-leave="${settings.stopOnSlideLeave}"`,
        `data-volume="${settings.volume}"`,
        `data-start-time="${settings.startTime}"`,
        `data-end-time="${settings.endTime}"`,
        `data-player-style="${settings.playerStyle}"`
      ].join(' ');

      // ---------- Сборка контролов по playerStyle ----------
      const playBtnHtml = `<button type="button" class="exp-video-play" aria-label="Play">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>`;

      const progressHtml = `<div class="exp-video-progress"><div class="exp-video-fill"></div></div>`;

      const timeHtml = `<span class="exp-video-time">0:00</span>`;

      // Иконки для кнопки mute
      const volumeOnSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>`;

      const muteBtnHtml = `<button type="button" class="exp-video-mute" aria-label="Mute">
        ${volumeOnSvg}
      </button>`;

      // Ползунок громкости — только для playerStyle="full"
      const volumeSliderHtml = `<input type="range" class="exp-video-volume" min="0" max="1" step="0.01" value="${settings.volume}" aria-label="Volume" />`;

      const fullscreenBtnHtml = `<button type="button" class="exp-video-fullscreen" aria-label="Fullscreen">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
          <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
          <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
          <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
        </svg>
      </button>`;

      let controlsHtml = '';
      if (settings.controls !== false) {
        if (settings.playerStyle === 'minimal') {
          // Только play и прогресс
          controlsHtml = playBtnHtml + progressHtml;
        } else if (settings.playerStyle === 'full') {
          // Всё: play, прогресс, время, mute + ползунок громкости, fullscreen
          controlsHtml =
            playBtnHtml +
            progressHtml +
            timeHtml +
            muteBtnHtml +
            volumeSliderHtml +
            fullscreenBtnHtml;
        } else {
          // compact: play, прогресс, время, mute, fullscreen (без ползунка)
          controlsHtml =
            playBtnHtml +
            progressHtml +
            timeHtml +
            muteBtnHtml +
            fullscreenBtnHtml;
        }
      }

      const controlsBlock = controlsHtml
        ? `<div class="exp-video-controls">${controlsHtml}</div>`
        : '';

      if (hasInnerShadow) {
        // Ветка с внутренней тенью — оборачиваем в SVG с фильтром
        const filterId = `video-inner-shadow-${el.id}`;
        const w = el.position.width;
        const h = el.position.height;
        const filterSvg = buildSvgInnerShadowFilter(el, filterId);

        const radius = el.transform?.borderRadius ?? 0;
        const smoothing = el.transform?.cornerSmoothing ?? 0;
        const clipId = `video-clip-${el.id}`;
        const needsClip = radius > 0;

        let squirclePathData = '';
        if (needsClip && smoothing > 0) {
          squirclePathData = squirclePath({
            width: w,
            height: h,
            cornerRadius: radius,
            cornerSmoothing: smoothing / 100
          });
        }

        const clipPathDef = needsClip
          ? `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">
              ${squirclePathData
                ? `<path d="${squirclePathData}" />`
                : `<rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" />`}
            </clipPath>`
          : '';

        const clipPathAttr = needsClip ? `clip-path="url(#${clipId})"` : '';

        inner = `<div class="media-wrapper">
          <svg class="media-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
            <defs>
              ${filterSvg}
              ${clipPathDef}
            </defs>
            <foreignObject x="0" y="0" width="${w}" height="${h}" filter="url(#${filterId})" ${clipPathAttr}>
              <video
                xmlns="http://www.w3.org/1999/xhtml"
                src="${src}"
                ${dataAttrs}
                playsinline
                preload="auto"
                style="width:100%;height:100%;object-fit:contain;display:block;"
              ></video>
            </foreignObject>
          </svg>
        </div>`;
      } else {
        // Обычная ветка — кастомный плеер с контролами по playerStyle
        inner = `<div class="media-wrapper">
          <div class="exp-video-player" ${dataAttrs}>
            <video
              src="${src}"
              preload="auto"
              playsinline
              style="width:100%;height:100%;object-fit:contain;display:block;"
            ></video>
            ${controlsBlock}
          </div>
        </div>`;
      }
      break;
    }

    case 'table': {
      inner = renderTable(el);
      break;
    }

    case 'chart': {
      inner = renderChart(el, slideIndex);
      break;
    }

    case 'shape': {
      if (el.shape?.maskTargetId) return '';
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

      const filterId = `inner-shadow-${el.id}`;
      const filterSvg = buildSvgInnerShadowFilter(el, filterId);
      const filterRef = filterSvg ? `url(#${filterId})` : '';

      const outlineWidth = el.transform?.outlineWidth ?? 0;
      const outlineColor = el.transform?.outlineColor ?? '#7c6cf0';
      const useOutline = outlineWidth > 0;

      const finalStroke = useOutline ? outlineColor : stroke;
      const finalStrokeWidth = useOutline ? outlineWidth : strokeWidth;

      // ---------- Маска для backdrop-filter ----------
      const needsMask = Boolean(el.effects?.backdropBlur?.enabled);
      const maskId = `shape-mask-${el.id}`;

      const maskSvg = needsMask
        ? `<svg class="shape-mask-defs" width="0" height="0" style="position:absolute;pointer-events:none" aria-hidden="true">
            <defs>
              <mask id="${maskId}" maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
                <rect x="0" y="0" width="1" height="1" fill="black"/>
                <path d="${normalizePath(path)}" fill="white"/>
              </mask>
            </defs>
          </svg>`
        : '';

      inner = `<div class="isolate-layer">${maskSvg}<svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        ${filterSvg ? `<defs>${filterSvg}</defs>` : ''}
        <path
          d="${path}"
          fill="${fill}"
          stroke="${finalStroke}"
          stroke-width="${finalStrokeWidth}"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
          ${filterRef ? `filter="${filterRef}"` : ''}
        />
      </svg></div>`;
      break;
    }

    default:
      inner = "";
  }

  return wrapElement(el, inner, style);
}

function buildStyle(el: SlideElement): string {
  const pos = el.position;

  const left = (pos.x / CANVAS_W) * 100;
  const top = (pos.y / CANVAS_H) * 100;
  const width = (pos.width / CANVAS_W) * 100;
  const height = (pos.height / CANVAS_H) * 100;

  const parts: string[] = [
    'position:absolute',
    `left:${left.toFixed(3)}%`,
    `top:${top.toFixed(3)}%`,
    `width:${width.toFixed(3)}%`,
    `height:${height.toFixed(3)}%`
  ];

  return parts.join(';') + ';';
}

function pxToVw(value: string): string {
  const m = value.match(/^([\d.]+)px$/);
  if (!m) return value;
  const px = parseFloat(m[1]);
  const pct = (px / CANVAS_W) * 100;
  return `${pct.toFixed(4)}vw`;
}

function renderTable(el: SlideElement): string {
  let data: { headers: string[]; rows: string[][] };
  try {
    data = JSON.parse(el.content || '{"headers":[],"rows":[]}');
  } catch {
    data = { headers: [], rows: [] };
  }

  const settings = { ...DEFAULT_TABLE_SETTINGS, ...(el.table ?? {}) };

  const dataAttrs = [
    `data-show-header="${settings.showHeader}"`,
    `data-header-bg="${settings.headerBg}"`,
    `data-header-color="${settings.headerColor}"`,
    `data-cell-color="${settings.cellColor}"`,
    `data-border-color="${settings.borderColor}"`,
    `data-border-width="${settings.borderWidth}"`,
    `data-striped="${settings.striped}"`,
    `data-stripe-color="${settings.stripeColor}"`,
    `data-font-size="${settings.fontSize}"`,
    `data-text-align="${settings.textAlign}"`,
    `data-padding-x="${settings.paddingX}"`,
    `data-padding-y="${settings.paddingY}"`
  ].join(' ');

  // Перевод px (при 1280) в vw
  const fontSizeVw = (settings.fontSize / CANVAS_W) * 100;
  const paddingXVw = (settings.paddingX / CANVAS_W) * 100;
  const paddingYVw = (settings.paddingY / CANVAS_H) * 100;
  const borderVw = (settings.borderWidth / CANVAS_W) * 100;

  const tableStyle = [
    `width:100%`,
    `border-collapse:collapse`,
    `font-size:${fontSizeVw.toFixed(4)}vw`,
    `color:${settings.cellColor}`
  ].join(';');

  const thStyle = [
    `background:${settings.headerBg}`,
    `color:${settings.headerColor}`,
    `border:${borderVw.toFixed(4)}vw solid ${settings.borderColor}`,
    `text-align:${settings.textAlign}`,
    `padding:${paddingYVw.toFixed(4)}vw ${paddingXVw.toFixed(4)}vw`,
  ].join(';');

  const tdStyle = [
    `color:${settings.cellColor}`,
    `border:${borderVw.toFixed(4)}vw solid ${settings.borderColor}`,
    `text-align:${settings.textAlign}`,
    `padding:${paddingYVw.toFixed(4)}vw ${paddingXVw.toFixed(4)}vw`
  ].join(';');

  const head = settings.showHeader && data.headers.length
    ? `<thead><tr>${data.headers.map(h => `<th style="${thStyle}">${escapeHtml(h)}</th>`).join('')}</tr></thead>`
    : '';

  const body = `<tbody>${data.rows
    .map((r, i) => {
      const stripe = settings.striped && i % 2 === 1
        ? `background:${settings.stripeColor};`
        : '';
      return `<tr style="${stripe}">${r.map(c => `<td style="${tdStyle}">${escapeHtml(c)}</td>`).join('')}</tr>`;
    })
    .join('')}</tbody>`;

  return `<table class="exp-table" ${dataAttrs} style="${tableStyle}">${head}${body}</table>`;
}

function renderChart(el: SlideElement, slideIndex: number): string {
  const id = `chart-${slideIndex}-${el.id}`;
  const payload = escapeAttr(el.content || '{}');
  const settings = { ...DEFAULT_CHART_SETTINGS, ...(el.chart ?? {}) };

  const dataAttrs = [
    `data-show-dataset-label="${settings.showDatasetLabel}"`,
    `data-dataset-label-color="${settings.datasetLabelColor}"`,
    `data-dataset-label-size="${settings.datasetLabelSize}"`,
    `data-show-legend="${settings.showLegend}"`,
    `data-legend-color="${settings.legendColor}"`,
    `data-legend-size="${settings.legendSize}"`,
    `data-axis-label-color="${settings.axisLabelColor}"`,
    `data-axis-label-size="${settings.axisLabelSize}"`,
    `data-grid-color="${settings.gridColor}"`
  ].join(' ');

  return `<div class="chart-wrap"><canvas id="${id}" data-chart='${payload}' ${dataAttrs}></canvas></div>`;
}

async function resolveAsset(
  src: string,
  subdir: string,
  urlMap: Map<string, string>,
  assets: ExportAsset[],
  fallbackExt: string,
  inlineAssets: boolean
): Promise<string> {
  if (!src) return '';

  // data: — уже встроенный ресурс
  if (src.startsWith('data:')) {
    if (inlineAssets) return src;
    // если не inline — распаковываем в файл
  }

  // blob: — созданный через URL.createObjectURL
  // asset: — Tauri asset protocol (http://asset.localhost/... или asset://...)
  // http(s): — внешние ссылки; их НЕ копируем в assets, оставляем как есть
  // file: — на всякий случай
  const isLocal =
    src.startsWith('blob:') ||
    src.startsWith('asset:') ||
    src.startsWith('http://asset.localhost') ||
    src.startsWith('https://asset.localhost');

  // Внешние http(s) — оставляем как есть, не качаем
  if (src.startsWith('http://') || src.startsWith('https://')) {
    if (!src.startsWith('http://asset.localhost') && !src.startsWith('https://asset.localhost')) {
      return src;
    }
  }

  if (!isLocal && !src.startsWith('data:')) {
    return src;
  }

  if (inlineAssets) {
    if (src.startsWith('data:')) return src;
    const res = await fetch(src);
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  }

  if (urlMap.has(src)) return urlMap.get(src)!;

  const res = await fetch(src);
  if (!res.ok) {
    return '';
  }
  const blob = await res.blob();

  const ext = guessExt(blob.type, fallbackExt, src);
  const hash = await shortHash(src);
  const fileName = `${subdir}-${hash}.${ext}`;
  const relativePath = `assets/${subdir}/${fileName}`;

  assets.push({ relativePath, blob });
  urlMap.set(src, relativePath);
  return relativePath;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function guessExt(mime: string, fallback: string, src?: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };
  if (map[mime]) return map[mime];

  // Попробуем вытащить расширение из URL (для asset://.../file.mp4)
  if (src) {
    try {
      const clean = src.split('?')[0].split('#')[0];
      const last = clean.split('/').pop() ?? '';
      const decoded = decodeURIComponent(last);
      const m = decoded.match(/\.([a-z0-9]+)$/i);
      if (m) {
        const ext = m[1].toLowerCase();
        if (['png','jpg','jpeg','webp','gif','svg','avif','bmp'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
        if (['mp4','webm','ogg','ogv','mov','m4v','mkv'].includes(ext)) return ext;
        if (['mp3','wav','ogg','m4a','aac','flac','opus'].includes(ext)) return ext;
      }
    } catch { /* ignore */ }
  }

  return fallback;
}

async function shortHash(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(buf).slice(0, 6))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
// ---------- Встроенный CSS ----------

const EXPORT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  html {
    scroll-snap-type: y mandatory;
    scroll-behavior: smooth;
  }

  body {
    background: #0f0f14;
    color: #e8e8f0;
    font-family: 'Inter', system-ui, sans-serif;
    overflow-x: hidden;
  }

  .presentation { width: 100%; }

  .slide {
    position: relative;
    width: 100vw;
    height: 100vh;
    scroll-snap-align: start;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .slide-inner {
    position: relative;
    width: min(100vw, calc(100vh * 16 / 9));
    height: min(100vh, calc(100vw * 9 / 16));
    aspect-ratio: 16 / 9;
    overflow: hidden;
  }

  /* ---------- ЭЛЕМЕНТ ---------- */

  .slide-element {
    position: absolute;
  }

  .element-backdrop {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .element-content {
    position: relative;
    width: 100%;
    height: 100%;
    z-index: 1;
    overflow: visible;
  }

  /* ---------- ОБЁРТКА МЕДИА ---------- */

  .media-wrapper {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .media-wrapper > img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    display: block;
    filter: var(--element-filter, none);
    border-radius: var(--element-radius, 0);
    clip-path: var(--element-clip-path, none);
    outline: var(--element-outline-width, 0) solid var(--element-outline-color, transparent);
    outline-offset: 0;
  }

  .media-wrapper > svg {
    max-width: 100%;
    max-height: 100%;
    display: block;
    filter: var(--element-filter, none);
    border-radius: var(--element-radius, 0);
    clip-path: var(--element-clip-path, none);
    outline: var(--element-outline-width, 0) solid var(--element-outline-color, transparent);
    outline-offset: 0;
  }

  .media-wrapper > .media-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  .media-svg foreignObject > img,
  .media-svg foreignObject > video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .media-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  /* ---------- КАРТИНКА И ВИДЕО БЕЗ ОБЁРТКИ (fallback) ---------- */

  .element-content > img,
  .element-content > video {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
    filter: var(--element-filter, none);
    border-radius: var(--element-radius, 0);
    clip-path: var(--element-clip-path, none);
  }

  /* ---------- ВИДЕО ---------- */

  /* ---------- EMBED (YouTube, Rutube, VK, Dzen) ---------- */

  .exp-embed-player {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
    overflow: hidden;
    border-radius: inherit;
  }

  .exp-embed-player iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: none;
    display: block;
    vertical-align: top;
  }

  .exp-video-player {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
    overflow: hidden;
    border-radius: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .exp-video-player > video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .exp-video-controls {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
    color: #fff;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .exp-video-player:hover .exp-video-controls,
  .exp-video-player.show-controls .exp-video-controls {
    opacity: 1;
  }

  .exp-video-player[data-controls="false"] .exp-video-controls {
    display: none;
  }

  .exp-video-play,
  .exp-video-mute,
  .exp-video-fullscreen {
    width: 32px;
    height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.15);
    border: none;
    border-radius: 50%;
    color: #fff;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .exp-video-play:hover,
  .exp-video-mute:hover,
  .exp-video-fullscreen:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(1.05);
  }

  .exp-video-play:active,
  .exp-video-mute:active,
  .exp-video-fullscreen:active {
    transform: scale(0.95);
  }

  .exp-video-play.playing svg { display: none; }
  .exp-video-play.playing::after {
    content: '';
    width: 12px;
    height: 12px;
    background: #fff;
    clip-path: polygon(0 0, 0 100%, 35% 100%, 35% 0, 65% 0, 65% 100%, 100% 100%, 100% 0);
  }

  .exp-video-progress {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    position: relative;
    cursor: pointer;
    min-width: 0;
  }

  .exp-video-fill {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    background: #7c6cf0;
    border-radius: 2px;
    width: 0;
    pointer-events: none;
  }

  .exp-video-time {
    font-family: monospace;
    font-size: 11px;
    color: #fff;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* Ползунок громкости — только в playerStyle="full" */
  .exp-video-volume {
    width: 80px;
    height: 4px;
    flex-shrink: 0;
    accent-color: #7c6cf0;
    cursor: pointer;
    background: transparent;
    -webkit-appearance: none;
    appearance: none;
  }

  .exp-video-volume::-webkit-slider-runnable-track {
    height: 4px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 2px;
  }
  .exp-video-volume::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -4px;
    border-radius: 50%;
    background: #fff;
    border: none;
    cursor: pointer;
    transition: transform 0.15s ease;
  }
  .exp-video-volume::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  .exp-video-volume::-moz-range-track {
    height: 4px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 2px;
  }
  .exp-video-volume::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    border: none;
    cursor: pointer;
  }

  /* Когда controls=false — скрываем панель всегда */
  .exp-video-player[data-controls="false"] .exp-video-controls {
    display: none;
  }

  /* В minimal и compact ползунок скрыт, даже если случайно попал в DOM */
  .exp-video-player[data-player-style="minimal"] .exp-video-volume,
  .exp-video-player[data-player-style="compact"] .exp-video-volume {
    display: none;
  }

  /* ---------- ВИДЫ ПЛЕЕРА ---------- */

  /* minimal — панель видна всегда */
  .exp-video-player[data-player-style="minimal"] .exp-video-controls {
    padding: 6px 10px;
    gap: 8px;
    opacity: 1;
  }

  /* compact — панель появляется при ховере */
  .exp-video-player[data-player-style="compact"] .exp-video-controls {
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .exp-video-player[data-player-style="compact"]:hover .exp-video-controls {
    opacity: 1;
  }

  /* full — панель видна всегда */
  .exp-video-player[data-player-style="full"] .exp-video-controls {
    opacity: 1;
  }

  /* ---------- ТЕКСТ ---------- */

  .el-text {
    width: 100%;
    height: 100%;
    padding: 6px 10px;
    overflow: hidden;
    word-break: break-word;
    color: var(--text-primary);
    filter: var(--element-filter, none);
    box-shadow: var(--inner-shadow, none);
    border-radius: var(--element-radius, 0);
    clip-path: var(--element-clip-path, none);
    outline: var(--element-outline-width, 0) solid var(--element-outline-color, transparent);
    outline-offset: 0;
    cursor: default;
    white-space: pre-wrap;
  }

  /* ---------- SVG И CANVAS ---------- */

  .element-content svg,
  .element-content canvas {
    filter: var(--element-filter, none);
    border-radius: var(--element-radius, 0);
    clip-path: var(--element-clip-path, none);
  }

  .shape-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  .shape-mask-defs {
    position: absolute;
    width: 0;
    height: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .isolate-layer {
    width: 100%;
    height: 100%;
    position: relative;
    isolation: isolate;
    contain: layout style;
    transform: translateZ(0);
  }

  .chart-wrap {
    width: 100%;
    height: 100%;
    padding: 8px;
    position: relative;
    box-sizing: border-box;
  }

  .chart-wrap > canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }

  /* ---------- АУДИО ---------- */

  .exp-audio-player {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 100%;
    padding: 6px 10px;
    background: rgba(38, 38, 51, 0.6);
    border: 1px solid #2a2a38;
    border-radius: 8px;
    color: #e8e8f0;
    box-sizing: border-box;
    opacity: 0.55;
    transition: opacity 0.2s ease, background 0.2s ease;
  }
  .exp-audio-player:hover {
    opacity: 1;
    background: rgba(38, 38, 51, 0.95);
  }

  .exp-audio-play {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #7c6cf0;
    border: none;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s ease, transform 0.15s ease;
  }
  .exp-audio-play:hover { background: #9184f5; transform: scale(1.05); }
  .exp-audio-play:active { transform: scale(0.95); }
  .exp-audio-play.playing svg { display: none; }
  .exp-audio-play.playing::after {
    content: '';
    width: 10px;
    height: 10px;
    background: #fff;
    clip-path: polygon(0 0, 0 100%, 35% 100%, 35% 0, 65% 0, 65% 100%, 100% 100%, 100% 0);
  }

  .exp-audio-progress {
    flex: 1;
    height: 4px;
    background: #0f0f14;
    border-radius: 2px;
    position: relative;
    cursor: pointer;
    min-width: 0;
  }
  .exp-audio-fill {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    background: #7c6cf0;
    border-radius: 2px;
    width: 0;
    pointer-events: none;
  }
  .exp-audio-time {
    font-family: monospace;
    font-size: 11px;
    color: #a0a0b8;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* -------- Виды плеера -------- */

  /* minimal — только play и прогресс */
  .exp-audio-player[data-player-style="minimal"] .exp-audio-time { display: none; }
  .exp-audio-player[data-player-style="minimal"] { padding: 4px 8px; gap: 6px; }

  /* compact — play, прогресс, время */
  .exp-audio-player[data-player-style="compact"] { /* базовый вид */ }

  /* full — с громкостью */
  .exp-audio-player[data-player-style="full"] {
    gap: 10px;
  }
  .exp-audio-player[data-player-style="full"] .exp-audio-volume {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 80px;
    flex-shrink: 0;
  }
  .exp-audio-player[data-player-style="full"] .exp-audio-volume input {
    width: 100%;
    accent-color: #7c6cf0;
  }

  /* Скрытые контролы — плеер занимает только полоску */
  .exp-audio-player[data-hide-controls="true"] {
    padding: 2px;
    background: transparent;
    border: none;
    opacity: 0;
  }
  .exp-audio-player[data-hide-controls="true"]:hover {
    opacity: 1;
    background: rgba(38, 38, 51, 0.9);
  }

  /* ---------- ТАБЛИЦЫ ---------- */

  .exp-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95em;
    table-layout: auto;
    filter: var(--element-filter, none);
    border-radius: var(--element-radius, 0);
    clip-path: var(--element-clip-path, none);
  }
  .exp-table th,
  .exp-table td {
    border: 1px solid #2a2a38;
    padding: 0.5vw 0.8vw;
    text-align: left;
    overflow-wrap: anywhere;
  }
  .exp-table th {
    background: #1e1e28;
  }

  /* ---------- МАСКА КАРТИНКИ ---------- */

  .slide-inner img[data-masked] {
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }

  /* ---------- НАВИГАЦИЯ ---------- */

  .nav {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 14px;
    background: rgba(38, 38, 51, 0.9);
    border: 1px solid #2a2a38;
    border-radius: 999px;
    z-index: 100;
    font-size: 13px;
    color: #a0a0b8;
    backdrop-filter: blur(8px);
  }
  .nav button {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid #3a3a4d;
    color: #e8e8f0;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
  }
  .nav button:hover { background: #2e2e3d; }

  /* ---------- ПЕРЕХОДЫ ---------- */

  .slide.is-visible[data-transition="fade"] .slide-inner {
    animation: fadeIn 0.7s ease both;
  }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

  .slide.is-visible[data-transition="slide-up"] .slide-inner {
    animation: slideUp 0.7s ease both;
  }
  @keyframes slideUp {
    from { transform: translateY(60px); opacity: 0 }
    to { transform: translateY(0); opacity: 1 }
  }

  .slide.is-visible[data-transition="slide-down"] .slide-inner {
    animation: slideDown 0.7s ease both;
  }
  @keyframes slideDown {
    from { transform: translateY(-60px); opacity: 0 }
    to { transform: translateY(0); opacity: 1 }
  }

  .slide.is-visible[data-transition="slide-left"] .slide-inner {
    animation: slideLeft 0.7s ease both;
  }
  @keyframes slideLeft {
    from { transform: translateX(80px); opacity: 0 }
    to { transform: translateX(0); opacity: 1 }
  }

  .slide.is-visible[data-transition="slide-right"] .slide-inner {
    animation: slideRight 0.7s ease both;
  }
  @keyframes slideRight {
    from { transform: translateX(-80px); opacity: 0 }
    to { transform: translateX(0); opacity: 1 }
  }

  .slide.is-visible[data-transition="zoom-in"] .slide-inner {
    animation: zoomIn 0.7s ease both;
  }
  @keyframes zoomIn {
    from { transform: scale(0.85); opacity: 0 }
    to { transform: scale(1); opacity: 1 }
  }

  .slide.is-visible[data-transition="zoom-out"] .slide-inner {
    animation: zoomOut 0.7s ease both;
  }
  @keyframes zoomOut {
    from { transform: scale(1.15); opacity: 0 }
    to { transform: scale(1); opacity: 1 }
  }

  .slide.is-visible[data-transition="rotate"] .slide-inner {
    animation: rotateIn 0.8s ease both;
  }
  @keyframes rotateIn {
    from { transform: rotate(-10deg) scale(0.9); opacity: 0 }
    to { transform: rotate(0) scale(1); opacity: 1 }
  }

  .slide.is-visible[data-transition="flip"] .slide-inner {
    animation: flipIn 0.8s ease both;
  }
  @keyframes flipIn {
    from { transform: perspective(1200px) rotateY(-90deg); opacity: 0 }
    to { transform: perspective(1200px) rotateY(0); opacity: 1 }
  }

  .slide[data-transition="none"] .slide-inner {
    animation: none;
  }

  @media (max-width: 600px) {
    .exp-table th,
    .exp-table td { padding: 4px 6px; font-size: 0.85em; }
  }

  /* ---------- АНИМАЦИИ ЭЛЕМЕНТОВ ---------- */

  .slide-element[data-anim] {
    animation-duration: var(--anim-duration, 500ms);
    animation-delay: var(--anim-delay, 0ms);
    animation-timing-function: var(--anim-easing, ease-out);
    animation-fill-mode: both;
    animation-play-state: paused;
  }

  .slide-element[data-anim].animated {
    animation-play-state: running;
  }

  @keyframes animFade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes animSlideUp {
    from { transform: translateY(40px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  @keyframes animSlideDown {
    from { transform: translateY(-40px); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
  }

  @keyframes animSlideLeft {
    from { transform: translateX(60px); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }

  @keyframes animSlideRight {
    from { transform: translateX(-60px); opacity: 0; }
    to   { transform: translateX(0);     opacity: 1; }
  }

  @keyframes animZoomIn {
    from { transform: scale(0.6); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  @keyframes animZoomOut {
    from { transform: scale(1.4); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  @keyframes animRotate {
    from { transform: rotate(-180deg) scale(0.5); opacity: 0; }
    to   { transform: rotate(0deg) scale(1);      opacity: 1; }
  }

  @keyframes animFlip {
    from { transform: perspective(1200px) rotateY(-90deg); opacity: 0; }
    to   { transform: perspective(1200px) rotateY(0deg);   opacity: 1; }
  }

  @keyframes animBounce {
    0%   { transform: translateY(-80px); opacity: 0; }
    60%  { transform: translateY(10px);  opacity: 1; }
    80%  { transform: translateY(-4px);  opacity: 1; }
    100% { transform: translateY(0);     opacity: 1; }
  }

  @keyframes animSpin {
    from { transform: rotate(0deg) scale(0.5); opacity: 0; }
    to   { transform: rotate(720deg) scale(1); opacity: 1; }
  }

  @keyframes animWipeLeft {
    from { clip-path: inset(0 100% 0 0); opacity: 0.4; }
    to   { clip-path: inset(0 0 0 0);    opacity: 1; }
  }

  @keyframes animWipeRight {
    from { clip-path: inset(0 0 0 100%); opacity: 0.4; }
    to   { clip-path: inset(0 0 0 0);    opacity: 1; }
  }

  @keyframes animWipeUp {
    from { clip-path: inset(100% 0 0 0); opacity: 0.4; }
    to   { clip-path: inset(0 0 0 0);    opacity: 1; }
  }

  @keyframes animWipeDown {
    from { clip-path: inset(0 0 100% 0); opacity: 0.4; }
    to   { clip-path: inset(0 0 0 0);    opacity: 1; }
  }

  @keyframes animGrow {
    from { transform: scale(0);   opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  @keyframes animShrink {
    from { transform: scale(2.5); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  @keyframes animDrop {
    0%   { transform: translateY(-120px) scale(0.9); opacity: 0; }
    70%  { transform: translateY(8px)    scale(1.02); opacity: 1; }
    100% { transform: translateY(0)      scale(1);    opacity: 1; }
  }

  @keyframes animRise {
    from { transform: translateY(60px) scale(0.95); opacity: 0; }
    to   { transform: translateY(0)    scale(1);    opacity: 1; }
  }

  @keyframes animPulse {
    0%   { transform: scale(1);   opacity: 0.6; }
    50%  { transform: scale(1.06); opacity: 1; }
    100% { transform: scale(1);   opacity: 1; }
  }

  .anim-fade        { animation-name: animFade; }
  .anim-slide-up    { animation-name: animSlideUp; }
  .anim-slide-down  { animation-name: animSlideDown; }
  .anim-slide-left  { animation-name: animSlideLeft; }
  .anim-slide-right { animation-name: animSlideRight; }
  .anim-zoom-in     { animation-name: animZoomIn; }
  .anim-zoom-out    { animation-name: animZoomOut; }
  .anim-rotate      { animation-name: animRotate; }
  .anim-flip        { animation-name: animFlip; }
  .anim-bounce      { animation-name: animBounce; }
  .anim-spin        { animation-name: animSpin; }
  .anim-wipe-left   { animation-name: animWipeLeft; }
  .anim-wipe-right  { animation-name: animWipeRight; }
  .anim-wipe-up     { animation-name: animWipeUp; }
  .anim-wipe-down   { animation-name: animWipeDown; }
  .anim-grow        { animation-name: animGrow; }
  .anim-shrink      { animation-name: animShrink; }
  .anim-drop        { animation-name: animDrop; }
  .anim-rise        { animation-name: animRise; }
  .anim-pulse       { animation-name: animPulse; }

  [data-anim][style*="--anim-easing: spring"] {
    animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
  }
`;

const EXPORT_JS = `
(() => {
    const slides = Array.from(document.querySelectorAll('.slide'));
    const startIdx = (typeof window.__START_SLIDE__ === 'number')
      ? Math.max(0, Math.min(slides.length - 1, window.__START_SLIDE__))
      : 0;

    let idx = startIdx;

    // Скролл к стартовому слайду после загрузки
    if (idx > 0) {
      requestAnimationFrame(() => {
        slides[idx]?.scrollIntoView({ behavior: 'auto' });
      });
    }

    const counter = document.getElementById('counter');

    const clickProgress = new WeakMap();

    const update = () => {
      if (counter) counter.textContent = (idx + 1) + ' / ' + slides.length;
    };

    function goTo(i) {
      idx = Math.max(0, Math.min(slides.length - 1, i));
      slides[idx]?.scrollIntoView({ behavior: 'smooth' });
      update();
    }

    // ---------- Анимации ----------
    function resetAnimations(slide) {
      slide.querySelectorAll('[data-anim]').forEach((el) => {
        el.classList.remove('animated');
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
        el.style.animationDelay = '';
        el.style.animationPlayState = 'paused';
      });
      clickProgress.set(slide, 0);
    }

    function runAutoAnimations(slide) {
      const elements = Array.from(slide.querySelectorAll('[data-anim]'));
      let afterPrevDelay = 0;

      elements.forEach((el) => {
        const trigger = el.dataset.trigger || 'onClick';
        const duration = parseInt(el.style.getPropertyValue('--anim-duration') || '500', 10);
        const delay = parseInt(el.style.getPropertyValue('--anim-delay') || '0', 10);

        if (trigger === 'withPrevious') {
          el.style.animationPlayState = 'running';
        } else if (trigger === 'afterPrevious') {
          afterPrevDelay += duration + delay;
          el.style.animationDelay = afterPrevDelay + 'ms';
          el.style.animationPlayState = 'running';
        }
      });
    }

    function advanceClickAnimations(slide) {
      if (!slide) return false;
      const clickEls = Array.from(slide.querySelectorAll('[data-anim][data-trigger="onClick"]'));
      const progress = clickProgress.get(slide) ?? 0;
      if (progress >= clickEls.length) return false;
      const el = clickEls[progress];
      el.classList.add('animated');
      el.style.animationPlayState = 'running';
      clickProgress.set(slide, progress + 1);
      return true;
    }

    function hasPendingClick(slide) {
      if (!slide) return false;
      const clickEls = slide.querySelectorAll('[data-anim][data-trigger="onClick"]');
      const progress = clickProgress.get(slide) ?? 0;
      return progress < clickEls.length;
    }

    // ---------- Аудио: настройка плееров ----------
    document.querySelectorAll('.exp-audio-player').forEach((player) => {
      const audio = player.querySelector('audio');
      if (!audio) return;

      const playBtn = player.querySelector('.exp-audio-play');
      const progress = player.querySelector('.exp-audio-progress');
      const fill = player.querySelector('.exp-audio-fill');
      const timeEl = player.querySelector('.exp-audio-time');
      const volumeInput = player.querySelector('.exp-audio-volume input[type="range"]');

      const volume = parseFloat(player.dataset.volume || '1');
      const startTime = parseFloat(player.dataset.startTime || '0');
      const endTime = parseFloat(player.dataset.endTime || '0');
      const loop = player.dataset.loop === 'true';
      const autoplay = player.dataset.autoplay === 'true';

      audio.volume = volume;
      audio.loop = loop && endTime === 0;

      if (volumeInput) {
        volumeInput.value = String(volume);
        volumeInput.addEventListener('input', (e) => {
          const v = parseFloat(e.currentTarget.value);
          audio.volume = Math.max(0, Math.min(1, v));
        });
        volumeInput.addEventListener('click', (e) => e.stopPropagation());
        volumeInput.addEventListener('pointerdown', (e) => e.stopPropagation());
      }

      function updateTime() {
        if (!timeEl) return;
        const cur = Math.max(0, audio.currentTime - startTime);
        const end = endTime > 0 ? endTime : audio.duration;
        const total = end - startTime;
        timeEl.textContent = formatTime(cur) + ' / ' + formatTime(total);
        if (fill && total > 0) {
          fill.style.width = (cur / total * 100) + '%';
        }
      }

      function formatTime(s) {
        if (!isFinite(s) || s < 0) return '0:00';
        return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
      }

      function start() {
        if (startTime > 0 && Math.abs(audio.currentTime - startTime) > 0.5) {
          audio.currentTime = startTime;
        }
        audio.play().catch((err) => {
          if (err.name === 'NotAllowedError') {
            const resume = () => {
              audio.play().catch(() => {});
              document.removeEventListener('click', resume);
              document.removeEventListener('keydown', resume);
              document.removeEventListener('touchstart', resume);
            };
            document.addEventListener('click', resume, { once: true });
            document.addEventListener('keydown', resume, { once: true });
            document.addEventListener('touchstart', resume, { once: true });
          } else {
            console.warn('[audio] play failed:', err);
          }
        });
      }

      player._startAudio = start;
      player._stopAudio = () => {
        audio.pause();
        audio.currentTime = startTime;
      };
      player._autoplay = autoplay;

      if (playBtn) {
        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (audio.paused) start();
          else audio.pause();
        });

        audio.addEventListener('play', () => playBtn.classList.add('playing'));
        audio.addEventListener('pause', () => playBtn.classList.remove('playing'));
      }

      audio.addEventListener('timeupdate', () => {
        updateTime();
        if (endTime > 0 && audio.currentTime >= endTime) {
          if (loop) {
            audio.currentTime = startTime;
            audio.play().catch(() => {});
          } else {
            audio.pause();
            audio.currentTime = startTime;
          }
        }
      });

      if (audio.readyState >= 1) {
        updateTime();
      } else {
        audio.addEventListener('loadedmetadata', updateTime);
      }

      if (progress) {
        progress.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = progress.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const end = endTime > 0 ? endTime : audio.duration;
          audio.currentTime = startTime + pct * (end - startTime);
        });
      }
    });

    // ---------- Навигация ----------
    document.getElementById('prev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      goTo(idx - 1);
    });

    document.getElementById('next')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = slides[idx];
      if (hasPendingClick(current)) {
        advanceClickAnimations(current);
      } else {
        goTo(idx + 1);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const current = slides[idx];
        if (hasPendingClick(current)) advanceClickAnimations(current);
        else goTo(idx + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(idx - 1);
      } else if (e.key === 'Home') {
        goTo(0);
      } else if (e.key === 'End') {
        goTo(slides.length - 1);
      }
    });

    // ---------- Клик по слайду ----------
    slides.forEach((slide) => {
      slide.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('.exp-audio-player')) return;
        if (target.closest('.exp-video-player')) return;
        if (target.closest('.nav')) return;

        // Запускаем аудио с playOnClick
        slide.querySelectorAll('.exp-audio-player[data-play-on-click="true"]').forEach((player) => {
          const audio = player.querySelector('audio');
          if (!audio) return;
          if (!audio.paused) return;
          if (player._startAudio) player._startAudio();
        });

        // Запускаем видео с playOnClick
        slide.querySelectorAll('.exp-video-player[data-play-on-click="true"]').forEach((player) => {
          const video = player.querySelector('video');
          if (!video) return;
          if (!video.paused) return;
          if (player._startVideo) player._startVideo();
        });

        // Если ещё есть отложенные onClick-анимации — проигрываем следующую
        if (advanceClickAnimations(slide)) {
          return;
        }

        // Все элементы появились — переключаем на следующий слайд
        goTo(idx + 1);
      });
    });

    // ---------- IntersectionObserver ----------
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const slide = entry.target;
        if (entry.isIntersecting) {
          resetAnimations(slide);
          slide.classList.remove('is-visible');
          void slide.offsetWidth;
          slide.classList.add('is-visible');
          setTimeout(() => runAutoAnimations(slide), 50);

          // Запускаем autoplay для аудио на этом слайде
          slide.querySelectorAll('.exp-audio-player[data-autoplay="true"]').forEach((player) => {
            if (player._autoplay && player._startAudio) {
              player._startAudio();
            }
          });

          // Запускаем autoplay для видео на этом слайде
          slide.querySelectorAll('.exp-video-player[data-autoplay="true"]').forEach((player) => {
            if (player._autoplay && player._startVideo) {
              player._startVideo();
            }
          });

          // Запускаем autoplay для видео под маской
          slide.querySelectorAll('svg video').forEach((video) => {
            if (video.closest('.exp-video-player')) return;
            if (video._autoplay && video._startVideo) {
              video._startVideo();
            }
          });
        } else {
          slide.classList.remove('is-visible');

          // Останавливаем аудио с data-stop-on-leave
          slide.querySelectorAll('.exp-audio-player[data-stop-on-leave="true"]').forEach((player) => {
            if (player._stopAudio) player._stopAudio();
          });

          // Останавливаем видео с data-stop-on-leave
          slide.querySelectorAll('.exp-video-player[data-stop-on-leave="true"]').forEach((player) => {
            if (player._stopVideo) player._stopVideo();
          });

          // Останавливаем видео под маской с data-stop-on-leave
          slide.querySelectorAll('svg video').forEach((video) => {
            if (video.closest('.exp-video-player')) return;
            if (video._stopOnLeave && video._stopVideo) {
              video._stopVideo();
            }
          });
        }
      });
    }, { threshold: 0.6, root: null });

    slides.forEach((s) => observer.observe(s));

    // ---------- Chart.js ----------
    document.querySelectorAll('canvas[data-chart]').forEach((c) => {
      try {
        const cfg = JSON.parse(c.getAttribute('data-chart') || '{}');
        const isCircular = cfg.kind === 'pie' || cfg.kind === 'doughnut';

        const showDatasetLabel = c.dataset.showDatasetLabel === 'true' && !isCircular;
        const datasetLabelColor = c.dataset.datasetLabelColor || '#e8e8f0';
        const datasetLabelSize = parseInt(c.dataset.datasetLabelSize || '13', 10);

        const showLegend = c.dataset.showLegend === 'true' && isCircular;
        const legendColor = c.dataset.legendColor || '#e8e8f0';
        const legendSize = parseInt(c.dataset.legendSize || '13', 10);

        const axisLabelColor = c.dataset.axisLabelColor || '#a0a0b8';
        const axisLabelSize = parseInt(c.dataset.axisLabelSize || '12', 10);
        const gridColor = c.dataset.gridColor || 'rgba(255,255,255,0.05)';

        const DEFAULT_COLORS = ['#7c6cf0', '#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#f472b6', '#a78bfa', '#94a3b8'];
        const colors = cfg.colors && cfg.colors.length ? cfg.colors : DEFAULT_COLORS;

        new Chart(c, {
          type: cfg.kind || 'bar',
          data: {
            labels: cfg.labels || [],
            datasets: [{
              label: cfg.datasetLabel || '',
              data: cfg.values || [],
              backgroundColor: colors,
              borderColor: colors,
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: showLegend,
                labels: { color: legendColor, font: { size: legendSize } }
              },
              title: {
                display: showDatasetLabel && Boolean(cfg.datasetLabel),
                text: cfg.datasetLabel || '',
                color: datasetLabelColor,
                font: { size: datasetLabelSize }
              }
            },
            scales: isCircular ? {} : {
              x: {
                ticks: { color: axisLabelColor, font: { size: axisLabelSize } },
                grid: { color: gridColor }
              },
              y: {
                ticks: { color: axisLabelColor, font: { size: axisLabelSize } },
                grid: { color: gridColor }
              }
            }
          }
        });
      } catch (e) { console.error('chart error', e); }
    });

    // ---------- Видео: настройка плееров ----------
    document.querySelectorAll('.exp-video-player').forEach((player) => {
      const video = player.querySelector('video');
      if (!video) return;

      const playBtn = player.querySelector('.exp-video-play');
      const progress = player.querySelector('.exp-video-progress');
      const fill = player.querySelector('.exp-video-fill');
      const timeEl = player.querySelector('.exp-video-time');
      const muteBtn = player.querySelector('.exp-video-mute');
      const volumeInput = player.querySelector('.exp-video-volume');
      const fsBtn = player.querySelector('.exp-video-fullscreen');

      const volume = parseFloat(player.dataset.volume || '1');
      const startTime = parseFloat(player.dataset.startTime || '0');
      const endTime = parseFloat(player.dataset.endTime || '0');
      const loop = player.dataset.loop === 'true';
      const muted = player.dataset.muted === 'true';
      const autoplay = player.dataset.autoplay === 'true';

      video.volume = volume;
      video.muted = muted;
      video.loop = loop && endTime === 0;

      function formatTime(s) {
        if (!isFinite(s) || s < 0) return '0:00';
        return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
      }

      function updateTime() {
        const cur = Math.max(0, video.currentTime - startTime);
        const end = endTime > 0 ? endTime : video.duration;
        const total = end - startTime;
        if (timeEl) timeEl.textContent = formatTime(cur) + ' / ' + formatTime(total);
        if (fill && total > 0) fill.style.width = (cur / total * 100) + '%';
      }

      function start() {
        if (startTime > 0 && Math.abs(video.currentTime - startTime) > 0.5) {
          video.currentTime = startTime;
        }
        video.play().catch((err) => {
          if (err.name === 'NotAllowedError') {
            const resume = () => {
              video.play().catch(() => {});
              document.removeEventListener('click', resume);
              document.removeEventListener('keydown', resume);
              document.removeEventListener('touchstart', resume);
            };
            document.addEventListener('click', resume, { once: true });
            document.addEventListener('keydown', resume, { once: true });
            document.addEventListener('touchstart', resume, { once: true });
          } else {
            console.warn('[video] play failed:', err);
          }
        });
      }

      player._startVideo = start;
      player._stopVideo = () => {
        video.pause();
        if (startTime > 0) video.currentTime = startTime;
      };
      player._autoplay = autoplay;

      if (playBtn) {
        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (video.paused) start();
          else video.pause();
        });
        video.addEventListener('play', () => playBtn.classList.add('playing'));
        video.addEventListener('pause', () => playBtn.classList.remove('playing'));
      }

      // Иконки для динамической замены
      const VOLUME_ON_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
      const VOLUME_OFF_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';

      function syncVolumeUI() {
        // Иконка mute
        if (muteBtn) {
          const showMuted = video.muted || video.volume === 0;
          muteBtn.innerHTML = showMuted ? VOLUME_OFF_SVG : VOLUME_ON_SVG;
        }
        // Ползунок — обновляем значение и disabled, если mute
        if (volumeInput) {
          const v = video.muted ? 0 : video.volume;
          // не дёргаем ползунок, пока пользователь его тащит
          if (document.activeElement !== volumeInput) {
            volumeInput.value = String(v);
          }
        }
      }

      // Инициализация
      if (volumeInput) {
        volumeInput.value = String(video.muted ? 0 : video.volume);
      }

      if (muteBtn) {
        muteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Если громкость 0 — «размьютить» и вернуть к 1
          if (video.muted || video.volume === 0) {
            video.muted = false;
            if (video.volume === 0) video.volume = 1;
          } else {
            video.muted = true;
          }
          syncVolumeUI();
        });
      }

      if (volumeInput) {
        volumeInput.addEventListener('input', (e) => {
          e.stopPropagation();
          const v = parseFloat(e.currentTarget.value);
          video.volume = Math.max(0, Math.min(1, v));
          // Если пользователь выкрутил в 0 — приглушаем
          video.muted = video.volume === 0;
          syncVolumeUI();
        });
        volumeInput.addEventListener('click', (e) => e.stopPropagation());
        volumeInput.addEventListener('pointerdown', (e) => e.stopPropagation());
      }

      // Реагируем на программное изменение громкости (autoplay, скрипты)
      video.addEventListener('volumechange', syncVolumeUI);

      syncVolumeUI();

      if (fsBtn) {
        fsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            player.requestFullscreen();
          }
        });
      }

      if (progress) {
        progress.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = progress.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const end = endTime > 0 ? endTime : video.duration;
          video.currentTime = startTime + pct * (end - startTime);
        });
      }

      video.addEventListener('timeupdate', () => {
        updateTime();
        if (endTime > 0 && video.currentTime >= endTime) {
          if (loop) {
            video.currentTime = startTime;
            video.play().catch(() => {});
          } else {
            video.pause();
            video.currentTime = startTime;
          }
        }
      });

      if (video.readyState >= 1) {
        updateTime();
      } else {
        video.addEventListener('loadedmetadata', updateTime);
      }
    });

    // ---------- Видео в маске: клик по маске запускает/останавливает видео ----------
    // Для видео, обёрнутых в SVG с clip-path, нет .exp-video-player,
    // поэтому вешаем обработчик на сам <video> и на SVG-обёртку.
    // ---------- Видео в маске: настройка + клик запускает/останавливает ----------
    document.querySelectorAll('svg video').forEach((video) => {
      // Если у видео уже есть .exp-video-player-родитель — пропускаем
      if (video.closest('.exp-video-player')) return;

      const svg = video.closest('svg');
      if (!svg) return;

      // ---------- Читаем настройки из data-* ----------
      const volume = parseFloat(video.dataset.volume || '1');
      const muted = video.dataset.muted === 'true';
      const loop = video.dataset.loop === 'true';
      const autoplay = video.dataset.autoplay === 'true';
      const startTime = parseFloat(video.dataset.startTime || '0');
      const endTime = parseFloat(video.dataset.endTime || '0');
      const stopOnLeave = video.dataset.stopOnLeave === 'true';

      // Применяем настройки
      video.volume = Math.max(0, Math.min(1, volume));
      video.muted = muted;
      video.loop = loop && endTime === 0;

      // ---------- Функции управления ----------
      const start = () => {
        if (startTime > 0 && Math.abs(video.currentTime - startTime) > 0.5) {
          video.currentTime = startTime;
        }
        video.play().catch((err) => {
          if (err.name === 'NotAllowedError') {
            const resume = () => {
              video.play().catch(() => {});
              document.removeEventListener('click', resume);
              document.removeEventListener('keydown', resume);
              document.removeEventListener('touchstart', resume);
            };
            document.addEventListener('click', resume, { once: true });
            document.addEventListener('keydown', resume, { once: true });
            document.addEventListener('touchstart', resume, { once: true });
          } else {
            console.warn('[masked video] play failed:', err);
          }
        });
      };

      const stop = () => {
        video.pause();
        if (startTime > 0) video.currentTime = startTime;
      };

      const toggle = (e) => {
        e.stopPropagation();
        if (video.paused) start();
        else video.pause();
      };

      // Сохраняем ссылки — пригодятся в IntersectionObserver
      video._startVideo = start;
      video._stopVideo = stop;
      video._autoplay = autoplay;
      video._stopOnLeave = stopOnLeave;

      // ---------- Клик запускает/останавливает ----------
      svg.style.cursor = 'pointer';
      svg.addEventListener('click', toggle);
      video.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle(e);
      });
      video.addEventListener('pointerdown', (e) => e.stopPropagation());

      // ---------- Обработка endTime + loop ----------
      video.addEventListener('timeupdate', () => {
        if (endTime > 0 && video.currentTime >= endTime) {
          if (loop) {
            video.currentTime = startTime;
            video.play().catch(() => {});
          } else {
            video.pause();
            video.currentTime = startTime;
          }
        }
      });
    });

    update();
  })();
`;

interface UsedFont {
  family: string;
  style: string;
  weight: string;
  fontStyle: string;
}

function collectFonts(slides: Slide[]): UsedFont[] {
  const seen = new Set<string>();
  const result: UsedFont[] = [];

  for (const slide of slides) {
    for (const el of slide.elements) {
      if (el.type !== 'text') continue;
      const s = el.style ?? {};
      const family = s.fontFamily as string | undefined;
      if (!family) continue;

      const styleName = (s.fontStyleName as string) ?? 'Regular';
      const key = `${family}|${styleName}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const weight = String(s.fontWeight ?? '400');
      const fontStyle = String(s.fontStyle ?? 'normal');

      result.push({ family, style: styleName, weight, fontStyle });
    }
  }
  return result;
}

async function buildFontFaces(
  slides: Slide[],
  inlineAssets: boolean,
  assets: ExportAsset[]
): Promise<string> {
  const used = collectFonts(slides);
  if (!used.length) return '';

  const cssRules: string[] = [];

  for (const f of used) {
    let file: FontFileData;
    try {
      file = await fonts.readFont(f.family, f.style);
    } catch {
      continue;
    }

    if (inlineAssets) {
      const dataUrl = `data:${file.mime};base64,${file.dataBase64}`;
      cssRules.push(`@font-face {
  font-family: '${f.family}';
  font-style: ${f.fontStyle};
  font-weight: ${f.weight};
  src: url('${dataUrl}') format('${formatFromMime(file.mime)}');
  font-display: swap;
}`);
    } else {
      const binary = base64ToBlob(file.dataBase64, file.mime);
      const relativePath = `assets/fonts/${file.fileName}`;
      assets.push({ relativePath, blob: binary });
      cssRules.push(`@font-face {
  font-family: '${f.family}';
  font-style: ${f.fontStyle};
  font-weight: ${f.weight};
  src: url('${relativePath}') format('${formatFromMime(file.mime)}');
  font-display: swap;
}`);
    }
  }

  return cssRules.join('\n\n');
}

function formatFromMime(mime: string): string {
  switch (mime) {
    case 'font/otf': return 'opentype';
    case 'font/woff': return 'woff';
    case 'font/woff2': return 'woff2';
    case 'font/collection': return 'collection';
    default: return 'truetype';
  }
}

function base64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
