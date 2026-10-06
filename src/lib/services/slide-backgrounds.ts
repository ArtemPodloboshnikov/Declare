import type { SlideBackground } from "$lib/stores/presentation.svelte";

export interface BackgroundPreset {
  id: string;
  labelKey: string;
  /** CSS-значение для background (gradient, pattern или color) */
  css: string;
  /** true, если пресет — светлый (для контраста текста) */
  light?: boolean;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'dark-solid',
    labelKey: 'bg.presets.darkSolid',
    css: '#0f0f14'
  },
  {
    id: 'light-solid',
    labelKey: 'bg.presets.lightSolid',
    css: '#f5f5f8',
    light: true
  },
  {
    id: 'purple-gradient',
    labelKey: 'bg.presets.purpleGradient',
    css: 'linear-gradient(135deg, #2d1b69 0%, #7c6cf0 100%)'
  },
  {
    id: 'ocean-gradient',
    labelKey: 'bg.presets.oceanGradient',
    css: 'linear-gradient(135deg, #0c4a6e 0%, #06b6d4 100%)'
  },
  {
    id: 'sunset-gradient',
    labelKey: 'bg.presets.sunsetGradient',
    css: 'linear-gradient(135deg, #7c2d12 0%, #fbbf24 100%)'
  },
  {
    id: 'forest-gradient',
    labelKey: 'bg.presets.forestGradient',
    css: 'linear-gradient(135deg, #14532d 0%, #4ade80 100%)'
  },
  {
    id: 'radial-glow',
    labelKey: 'bg.presets.radialGlow',
    css: 'radial-gradient(circle at 30% 20%, rgba(124,108,240,0.4), transparent 60%), radial-gradient(circle at 80% 80%, rgba(96,165,250,0.3), transparent 50%), #0f0f14'
  },
  {
    id: 'grid-dark',
    labelKey: 'bg.presets.gridDark',
    css: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px), #0f0f14'
  },
  {
    id: 'dots-light',
    labelKey: 'bg.presets.dotsLight',
    css: 'radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px), #f5f5f8',
    light: true
  },
  {
    id: 'noise-dark',
    labelKey: 'bg.presets.noiseDark',
    css: 'repeating-linear-gradient(45deg, #16161d 0, #16161d 2px, #1a1a22 2px, #1a1a22 4px)'
  }
];

export function presetById(id: string): BackgroundPreset | undefined {
  return BACKGROUND_PRESETS.find(p => p.id === id);
}

/**
 * Превращает SlideBackground в готовое CSS-значение для background.
 * Для типа 'image' возвращает background-image через url().
 */
export function backgroundToCss(bg?: SlideBackground): string {
  if (!bg) return '#0f0f14';

  if (bg.type === 'color') {
    return bg.color ?? '#0f0f14';
  }

  if (bg.type === 'preset') {
    return presetById(bg.presetId ?? 'dark-solid')?.css ?? '#0f0f14';
  }

  if (bg.type === 'image' && bg.imageUrl) {
    const fit = bg.imageFit ?? 'cover';
    const size = fit === 'contain' ? 'contain' : fit === 'repeat' ? 'auto' : 'cover';
    const repeat = fit === 'repeat' ? 'repeat' : 'no-repeat';
    return `url('${bg.imageUrl}') center/ ${size} ${repeat}`;
  }

  return '#0f0f14';
}

/**
 * Возвращает фоновые CSS-свойства для inline-стиля.
 * Для пресетов с несколькими слоями (grid, glow) нужно background-size и background-position.
 */
export function backgroundToStyle(bg?: SlideBackground): string {
  if (!bg) return 'background:#0f0f14;';

  if (bg.type === 'image' && bg.imageUrl) {
    const fit = bg.imageFit ?? 'cover';
    const size = fit === 'contain' ? 'contain' : fit === 'repeat' ? 'auto' : 'cover';
    const repeat = fit === 'repeat' ? 'repeat' : 'no-repeat';
    return `background-image:url('${bg.imageUrl}');background-position:center;background-size:${size};background-repeat:${repeat};`;
  }

  if (bg.type === 'color') {
    return `background:${bg.color ?? '#0f0f14'};`;
  }

  const preset = presetById(bg.presetId ?? 'dark-solid');
  if (!preset) return 'background:#0f0f14;';

  // Паттерны типа grid/dots требуют background-size
  if (preset.id === 'grid-dark') {
    return `background:${preset.css};background-size:24px 24px;`;
  }
  if (preset.id === 'dots-light') {
    return `background:${preset.css};background-size:16px 16px;`;
  }

  return `background:${preset.css};`;
}
