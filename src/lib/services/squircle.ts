import { getSvgPath } from 'figma-squircle';

export interface SquircleParams {
  width: number;
  height: number;
  cornerRadius: number;
  /** 0..1 */
  cornerSmoothing: number;
}

/**
 * Генерирует SVG path для squircle.
 * Возвращает строку path data, которую можно использовать в clip-path: path('...').
 */
export function squirclePath(params: SquircleParams): string {
  const { width, height, cornerRadius, cornerSmoothing } = params;

  // Если радиус или сглаживание нулевые — squircle не нужен
  if (cornerRadius <= 0 || cornerSmoothing <= 0) return '';

  return getSvgPath({
    width,
    height,
    cornerRadius,
    cornerSmoothing: Math.max(0, Math.min(1, cornerSmoothing)),
    // preserveSmoothing помогает сохранить эффект на больших радиусах
    preserveSmoothing: true
  });
}

/**
 * Нормализует SVG path из пикселей в диапазон 0..1
 * для использования с clipPathUnits="objectBoundingBox" или maskContentUnits="objectBoundingBox".
 *
 * Поддерживает команды: M, L, H, V, C, S, Q, T, A, Z (и строчные варианты).
 */
export function normalizePathToBBox(
  pathData: string,
  width: number,
  height: number
): string {
  if (!pathData || width <= 0 || height <= 0) return pathData;

  const tokens = pathData.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e-?\d+)?/gi);
  if (!tokens) return pathData;

  const out: string[] = [];
  let cmd = '';
  let i = 0;
  let curX = 0;
  let curY = 0;

  const readNum = (): number => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    const tk = tokens[i];
    if (/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tk)) {
      cmd = tk;
      out.push(tk);
      i++;
      if (cmd === 'Z' || cmd === 'z') {
        // Z не имеет параметров
        continue;
      }
      continue;
    }

    const upper = cmd.toUpperCase();
    const relative = cmd === cmd.toLowerCase();

    if (upper === 'M' || upper === 'L' || upper === 'T') {
      const x = readNum();
      const y = readNum();
      const nx = relative ? curX + x : x;
      const ny = relative ? curY + y : y;
      out.push((nx / width).toFixed(6), (ny / height).toFixed(6));
      curX = nx; curY = ny;
    } else if (upper === 'H') {
      const x = readNum();
      const nx = relative ? curX + x : x;
      out.push((nx / width).toFixed(6));
      curX = nx;
    } else if (upper === 'V') {
      const y = readNum();
      const ny = relative ? curY + y : y;
      out.push((ny / height).toFixed(6));
      curY = ny;
    } else if (upper === 'C') {
      for (let k = 0; k < 3; k++) {
        const x = readNum();
        const y = readNum();
        const nx = relative ? curX + x : x;
        const ny = relative ? curY + y : y;
        out.push((nx / width).toFixed(6), (ny / height).toFixed(6));
        curX = nx; curY = ny;
      }
    } else if (upper === 'S' || upper === 'Q') {
      for (let k = 0; k < 2; k++) {
        const x = readNum();
        const y = readNum();
        const nx = relative ? curX + x : x;
        const ny = relative ? curY + y : y;
        out.push((nx / width).toFixed(6), (ny / height).toFixed(6));
        curX = nx; curY = ny;
      }
    } else if (upper === 'A') {
      // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
      const rx = readNum();
      const ry = readNum();
      const rotation = readNum();
      const largeArc = readNum();
      const sweep = readNum();
      const x = readNum();
      const y = readNum();
      const nx = relative ? curX + x : x;
      const ny = relative ? curY + y : y;
      out.push(
        (rx / width).toFixed(6),
        (ry / height).toFixed(6),
        String(rotation),
        String(largeArc),
        String(sweep),
        (nx / width).toFixed(6),
        (ny / height).toFixed(6)
      );
      curX = nx; curY = ny;
    } else {
      // Неизвестная команда — пропускаем
      i++;
    }
  }

  return out.join(' ');
}
