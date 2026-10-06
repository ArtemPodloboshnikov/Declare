import type { Slide } from '$lib/stores/presentation.svelte';

export interface ShapeDefinition {
  kind: string;
  labelKey: string;
  path: string;  // SVG path data
  outline?: boolean;
}

export interface BoolOpResult {
  path: string;
  /** viewBox, в котором лежит результат */
  viewBox: string;
}

/** Готовые SVG-пути для базовых фигур (координаты в viewBox 0 0 100 100) */
export const SHAPES: ShapeDefinition[] = [
  { kind: 'circle',   labelKey: 'shapes.circle',   path: 'M 50 5 A 45 45 0 1 1 49.99 5 Z' },
  { kind: 'rect',     labelKey: 'shapes.rect',     path: 'M 5 5 H 95 V 95 H 5 Z' },
  { kind: 'triangle', labelKey: 'shapes.triangle', path: 'M 50 5 L 95 95 L 5 95 Z' },
  { kind: 'star',     labelKey: 'shapes.star',     path: 'M 50 5 L 61 38 L 95 38 L 67 59 L 78 92 L 50 71 L 22 92 L 33 59 L 5 38 L 39 38 Z' },
  { kind: 'arrow',    labelKey: 'shapes.arrow',    path: 'M 5 40 H 60 V 20 L 95 50 L 60 80 V 60 H 5 Z' },
  { kind: 'hexagon',  labelKey: 'shapes.hexagon',  path: 'M 50 5 L 92 27 L 92 73 L 50 95 L 8 73 L 8 27 Z' },
  { kind: 'pentagon', labelKey: 'shapes.pentagon', path: 'M 50 5 L 95 38 L 78 92 L 22 92 L 5 38 Z' },
  { kind: 'diamond',  labelKey: 'shapes.diamond',  path: 'M 50 5 L 95 50 L 50 95 L 5 50 Z' },
  { kind: 'line', labelKey: 'shapes.line', path: 'M 5 95 L 95 5', outline: true }
];

export function getShapePath(kind: string): string {
  return SHAPES.find(s => s.kind === kind)?.path ?? '';
}

export function isOutlineShape(kind: string): boolean {
  return SHAPES.find(s => s.kind === kind)?.outline === true;
}

export function isMasked(elementId: string, slide: Slide): boolean {
  return slide.elements.some(
    e => e.type === 'shape' && e.shape?.maskTargetId === elementId
  );
}
