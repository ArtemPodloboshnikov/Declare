import type { AnimationKind, AnimationTrigger, ElementAnimation } from '$lib/stores/presentation.svelte';

export interface AnimationDefinition {
  kind: AnimationKind;
  labelKey: string;
  /** CSS-класс, который будет навешан на элемент */
  cssClass: string;
  /** Иконка Lucide как строка имени для быстрого поиска (опционально) */
  icon?: string;
}

export const ANIMATIONS: AnimationDefinition[] = [
  { kind: 'none',         labelKey: 'anim.none',         cssClass: '' },
  { kind: 'fade',         labelKey: 'anim.fade',         cssClass: 'anim-fade' },
  { kind: 'slide-up',     labelKey: 'anim.slideUp',      cssClass: 'anim-slide-up' },
  { kind: 'slide-down',   labelKey: 'anim.slideDown',    cssClass: 'anim-slide-down' },
  { kind: 'slide-left',   labelKey: 'anim.slideLeft',    cssClass: 'anim-slide-left' },
  { kind: 'slide-right',  labelKey: 'anim.slideRight',   cssClass: 'anim-slide-right' },
  { kind: 'zoom-in',      labelKey: 'anim.zoomIn',       cssClass: 'anim-zoom-in' },
  { kind: 'zoom-out',     labelKey: 'anim.zoomOut',      cssClass: 'anim-zoom-out' },
  { kind: 'rotate',       labelKey: 'anim.rotate',       cssClass: 'anim-rotate' },
  { kind: 'flip',         labelKey: 'anim.flip',         cssClass: 'anim-flip' },
  { kind: 'bounce',       labelKey: 'anim.bounce',       cssClass: 'anim-bounce' },
  { kind: 'spin',         labelKey: 'anim.spin',         cssClass: 'anim-spin' },
  { kind: 'wipe-left',    labelKey: 'anim.wipeLeft',     cssClass: 'anim-wipe-left' },
  { kind: 'wipe-right',   labelKey: 'anim.wipeRight',    cssClass: 'anim-wipe-right' },
  { kind: 'wipe-up',      labelKey: 'anim.wipeUp',       cssClass: 'anim-wipe-up' },
  { kind: 'wipe-down',    labelKey: 'anim.wipeDown',     cssClass: 'anim-wipe-down' },
  { kind: 'grow',         labelKey: 'anim.grow',         cssClass: 'anim-grow' },
  { kind: 'shrink',       labelKey: 'anim.shrink',       cssClass: 'anim-shrink' },
  { kind: 'drop',         labelKey: 'anim.drop',         cssClass: 'anim-drop' },
  { kind: 'rise',         labelKey: 'anim.rise',         cssClass: 'anim-rise' },
  { kind: 'pulse',        labelKey: 'anim.pulse',        cssClass: 'anim-pulse' }
];

export const TRIGGERS: { value: AnimationTrigger; labelKey: string }[] = [
  { value: 'onClick',       labelKey: 'anim.trigger.onClick' },
  { value: 'withPrevious',  labelKey: 'anim.trigger.withPrevious' },
  { value: 'afterPrevious', labelKey: 'anim.trigger.afterPrevious' }
];

export const EASINGS = [
  { value: 'ease',         labelKey: 'anim.easing.ease' },
  { value: 'ease-in',      labelKey: 'anim.easing.easeIn' },
  { value: 'ease-out',     labelKey: 'anim.easing.easeOut' },
  { value: 'ease-in-out',  labelKey: 'anim.easing.easeInOut' },
  { value: 'linear',       labelKey: 'anim.easing.linear' },
  { value: 'spring',       labelKey: 'anim.easing.spring' }
] as const;

export const ANIM_DURATION_MIN = 100;
export const ANIM_DURATION_MAX = 3000;
export const ANIM_DURATION_DEFAULT = 500;
export const ANIM_DURATION_STEP = 50;

export function findAnimation(kind: AnimationKind): AnimationDefinition | undefined {
  return ANIMATIONS.find(a => a.kind === kind);
}

/**
 * Возвращает inline-стиль для анимации элемента.
 * Используется в Viewport и export.ts.
 */
export function animationStyle(anim?: ElementAnimation): string {
  if (!anim || anim.kind === 'none') return '';
  const parts: string[] = [];
  parts.push(`--anim-duration: ${anim.duration}ms`);
  parts.push(`--anim-delay: ${anim.delay}ms`);
  parts.push(`--anim-easing: ${anim.easing}`);
  return parts.join('; ');
}

export function animationClass(anim?: ElementAnimation): string {
  if (!anim || anim.kind === 'none') return '';
  const def = findAnimation(anim.kind);
  return def?.cssClass ?? '';
}

/**
 * Парсит анимацию из data-атрибутов .slide-element.
 * Возвращает undefined, если анимации нет.
 */
export function parseAnimation(el: HTMLElement): ElementAnimation | undefined {
  const kind = el.dataset.anim as AnimationKind | undefined;
  if (!kind || kind === 'none') return undefined;

  const trigger = (el.dataset.trigger as AnimationTrigger) || 'onClick';

  const duration = parseInt(el.style.getPropertyValue('--anim-duration') || '500', 10);
  const delay = parseInt(el.style.getPropertyValue('--anim-delay') || '0', 10);
  const easing = (el.style.getPropertyValue('--anim-easing') || 'ease-out') as ElementAnimation['easing'];

  return {
    kind,
    trigger,
    duration: Number.isNaN(duration) ? 500 : duration,
    delay: Number.isNaN(delay) ? 0 : delay,
    easing: isEasing(easing) ? easing : 'ease-out'
  };
}

function isEasing(v: string): v is ElementAnimation['easing'] {
  return ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'spring'].includes(v);
}
