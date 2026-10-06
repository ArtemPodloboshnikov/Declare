import { CANVAS_W } from "$lib/stores/app.svelte";

export function parseOutline(content: HTMLElement): { outlineWidth?: number; outlineColor?: string } {
  const wRaw = content.style.getPropertyValue('--element-outline-width');
  if (!wRaw) return {};

  const widthPx = parseVwToPx(wRaw);
  if (widthPx <= 0) return {};

  const color = content.style.getPropertyValue('--element-outline-color') || '#7c6cf0';
  return {
    outlineWidth: widthPx,
    outlineColor: color.trim()
  };
}

/**
 * Переводит vw-значение из экспорта в пиксели канваса.
 * 1vw = 1% ширины слайда = CANVAS_W / 100 px.
 */
export function parseVwToPx(value: string): number {
  const m = value.match(/^([\d.]+)vw$/);
  if (!m) return 0;
  return Math.round((parseFloat(m[1]) / 100) * CANVAS_W);
}


export function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(s: string): string {
  return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function rgbToHex(rgbString: string) {
  // Регулярное выражение для извлечения трёх чисел из строки
  const match = rgbString.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);

  if (match) {
    const [, r, g, b] = match;
    // Вспомогательная функция для преобразования одного компонента в HEX
    function componentToHex(c: any) {
      let hex = parseInt(c, 10).toString(16);
      return hex.length === 1 ? '0' + hex : hex; // Добавляем ведущий ноль, если нужно
    }

    // Собираем итоговый HEX-код
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
  } else {
    return null;
  }
}

export function fileNameFromAssetUrl(url: string): string {
  try {
    const last = url.split('/').pop()?.split('?')[0] ?? '';
    const decoded = decodeURIComponent(last);
    return decoded.split('\\').pop() ?? decoded;
  } catch {
    return url;
  }
}

export function isCircular(kind: string): boolean {
  return kind === 'pie' || kind === 'doughnut';
}
