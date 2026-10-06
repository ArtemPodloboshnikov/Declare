import type { SlideElement, ElementEffects, ElementTransform } from '$lib/stores/presentation.svelte';
import { squirclePath } from './squircle';

export interface StyleOptions {
  /** Коэффициент уменьшения для миниатюр (Viewport = 1) */
  scale?: number;
  /** Пиксельная единица измерения (px или vw) */
  unit?: 'px' | 'vw';
  /** Ширина канваса для конвертации в vw */
  canvasWidth?: number;
  /** Пропустить backdrop-filter (для редактора) */
  skipBackdrop?: boolean;
  /** Отключить squircle (для экспорта, где clip-path в px не масштабируется) */
  disableSquircle?: boolean;
}

export interface SplitStyles {
  /** Стили для контейнера .slide-element */
  container: string;
  /** Стили для .element-backdrop */
  backdrop: string;
  /** Стили для .element-content */
  content: string;
}

export function splitElementStyles(
  el: SlideElement,
  options: StyleOptions = {}
): SplitStyles {
  const {
    scale = 1,
    unit = 'px',
    canvasWidth = 1280,
    skipBackdrop = false,
    disableSquircle = false
  } = options;

  const t = el.transform ?? {};
  const e = el.effects ?? {};

  const len = (px: number): string => {
    if (unit === 'vw') return `${((px / canvasWidth) * 100).toFixed(3)}vw`;
    return `${px * scale}px`;
  };

  // ---------- CONTAINER ----------
  const containerParts: string[] = [];

  const hasBlend = t.blendMode && t.blendMode !== 'normal';
  const hasBackdrop = !skipBackdrop && e.backdropBlur?.enabled;
  // contain: paint обрезает box-shadow и drop-shadow — отключаем при тенях
  if (!hasBlend && !hasBackdrop) {
    containerParts.push('contain: layout');
  }

  if (!hasBlend) {
    containerParts.push('isolation: isolate');
  }

  // ---------- УГЛЫ ----------
  const radius = t.borderRadius ?? 0;
  const smoothing = t.cornerSmoothing ?? 0;

  function buildRadiusRules(): string[] {
    if (radius <= 0) return [];
    if (smoothing > 0 && !disableSquircle) {
      const path = squirclePath({
        width: el.position.width * scale,
        height: el.position.height * scale,
        cornerRadius: radius * scale,
        cornerSmoothing: smoothing / 100
      });
      if (path) {
        return [`clip-path:path('${path}')`, `-webkit-clip-path:path('${path}')`];
      }
    }
    return [`border-radius:${len(radius)}`];
  }

  const radiusRules = buildRadiusRules();

  // ---------- BACKDROP ----------
  const backdropParts: string[] = [
    'position: absolute',
    'inset: 0',
    'pointer-events: none',
    'z-index: 0'
  ];

  // Углы на бэкдропе — форма фрейма
  backdropParts.push(...radiusRules);

  if (!skipBackdrop) {
    const backdrop = buildBackdropFilter(e, scale);
    if (backdrop !== 'none') {
      backdropParts.push(`backdrop-filter:${backdrop}`);
      backdropParts.push(`-webkit-backdrop-filter:${backdrop}`);
    }
  }

  // ---------- CONTENT ----------
  const contentParts: string[] = [
    'position: relative',
    'width: 100%',
    'height: 100%',
    'z-index: 1',
    'overflow: visible'
  ];

  // Обводка — через CSS-переменную, применяется к содержимому
  if (t.outlineWidth && t.outlineWidth > 0) {
    contentParts.push(`--element-outline-width:${len(t.outlineWidth)}`);
    contentParts.push(`--element-outline-color:${t.outlineColor ?? '#7c6cf0'}`);
  }

  if (radius > 0) {
    // Передаём радиус через CSS-переменную,
    // чтобы применить к <img>, <svg>, <canvas>, <table>, .el-text
    contentParts.push(`--element-radius:${len(radius)}`);

    // Для squircle — тоже через переменную
    if (smoothing > 0 && !disableSquircle) {
      const path = squirclePath({
        width: el.position.width * scale,
        height: el.position.height * scale,
        cornerRadius: radius * scale,
        cornerSmoothing: smoothing / 100
      });
      if (path) {
        contentParts.push(`--element-clip-path:path('${path}')`);
      }
    }
  }

  if (t.opacity !== undefined && t.opacity < 1) {
    contentParts.push(`opacity:${t.opacity}`);
  }

  if (t.blendMode && t.blendMode !== 'normal') {
    contentParts.push(`mix-blend-mode:${t.blendMode}`);
  }

  // ---------- ФИЛЬТРЫ СОДЕРЖИМОГО ----------
  // drop-shadow и blur объединяются в одну CSS-переменную --element-filter,
  // которая применяется к детям .element-content через CSS-правило.
  // Это позволяет теням идти по контуру содержимого, а не фрейма.
  const contentFilter: string[] = [];

  if (e.dropShadow?.enabled) {
    const s = e.dropShadow;
    contentFilter.push(
      `drop-shadow(${s.x * scale}px ${s.y * scale}px ${s.blur * scale}px ${s.color})`
    );
  }

  if (e.blur?.enabled && e.blur.radius > 0) {
    contentFilter.push(`blur(${e.blur.radius * scale}px)`);
  }

  if (contentFilter.length > 0) {
    contentParts.push(`--element-filter:${contentFilter.join(' ')}`);
  }

  // ---------- ВНУТРЕННЯЯ ТЕНЬ ----------
  // Для не-SVG элементов (картинки, текст, canvas) используется inset box-shadow
  // через CSS-переменную --inner-shadow.
  // Для SVG-фигур — через SVG-фильтр buildSvgInnerShadowFilter (см. ShapeView).
  if (e.innerShadow?.enabled && el.type !== 'shape') {
    const s = e.innerShadow;
    const insetValue = `inset ${s.x * scale}px ${s.y * scale}px ${s.blur * scale}px ${s.spread * scale}px ${s.color}`;
    contentParts.push(`--inner-shadow:${insetValue}`);

    // Радиус для inset box-shadow — чтобы тень совпадала со скруглением
    if (radius > 0) {
      contentParts.push(`--inner-shadow-radius:${len(radius)}`);
    }
  }

  // Трансформации
  const transform = buildTransform(t);
  if (transform !== 'none') {
    containerParts.push(`transform:${transform}`)
  }

  return {
    container: containerParts.join(';'),
    backdrop: backdropParts.join(';'),
    content: contentParts.join(';')
  };
}

/**
 * SVG-фильтр для внутренней тени по контуру фигуры.
 * Используется в ShapeView для вставки <filter> в <defs>.
 *
 * Логика:
 * 1. feGaussianBlur размывает alpha-канал исходной фигуры.
 * 2. feOffset сдвигает размытие.
 * 3. feComposite с k2=-1 k3=1 инвертирует alpha (тень внутри контура).
 * 4. feFlood задаёт цвет.
 * 5. feComposite накладывает цвет на инвертированную alpha.
 * 6. feComposite накладывает результат поверх исходной фигуры.
 */
export function buildSvgInnerShadowFilter(
  el: SlideElement,
  filterId: string
): string {
  const e = el.effects;
  if (!e?.innerShadow?.enabled) return '';

  const s = e.innerShadow;
  const dx = s.x;
  const dy = s.y;
  const blur = Math.max(0.1, s.blur / 2);

  return `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="blur" />
    <feOffset in="blur" dx="${dx}" dy="${dy}" result="offsetBlur" />
    <feComposite in="offsetBlur" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="inverse" />
    <feFlood flood-color="${s.color}" result="color" />
    <feComposite in="color" in2="inverse" operator="in" result="shadow" />
    <feComposite in="shadow" in2="SourceGraphic" operator="over" />
  </filter>`;
}

/**
 * CSS inset box-shadow для внутренней тени — используется как fallback.
 */
export function buildInnerShadowCss(e?: ElementEffects, scale = 1): string {
  if (!e?.innerShadow?.enabled) return '';
  const s = e.innerShadow;
  return `inset ${s.x * scale}px ${s.y * scale}px ${s.blur * scale}px ${s.spread * scale}px ${s.color}`;
}

/**
 * Собирает CSS filter из эффектов (drop-shadow + blur).
 * Возвращает значение для filter: ..., а не CSS-переменную.
 * Используется редко — в основном для SVG и утилит.
 */
export function buildFilter(e?: ElementEffects, scale = 1): string {
  if (!e) return 'none';
  const parts: string[] = [];
  if (e.dropShadow?.enabled) {
    const s = e.dropShadow;
    parts.push(`drop-shadow(${s.x * scale}px ${s.y * scale}px ${s.blur * scale}px ${s.color})`);
  }
  if (e.blur?.enabled && e.blur.radius > 0) {
    parts.push(`blur(${e.blur.radius * scale}px)`);
  }
  return parts.length ? parts.join(' ') : 'none';
}

/**
 * Собирает backdrop-filter (размытие фона, стекло).
 */
export function buildBackdropFilter(e?: ElementEffects, scale = 1): string {
  if (!e) return 'none';
  if (e.backdropBlur?.enabled && e.backdropBlur.radius > 0) {
    return `blur(${e.backdropBlur.radius * scale}px)`;
  }
  return 'none';
}

/**
 * Собирает CSS transform: вращение + отражение.
 */
export function buildTransform(transform?: ElementTransform): string {
  if (!transform) return 'none';
  const parts: string[] = [];

  if (transform.rotation) parts.push(`rotate(${transform.rotation}deg)`);
  if (transform.flipX) parts.push('scaleX(-1)');
  if (transform.flipY) parts.push('scaleY(-1)');

  return parts.length ? parts.join(' ') : 'none';
}
