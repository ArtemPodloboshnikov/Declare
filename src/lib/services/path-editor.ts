export interface PathPoint {
  x: number;
  y: number;
  /** true — начало подобного сегмента (M), false — продолжение (L) */
  isMove?: boolean;
}

/**
 * Парсит SVG path в массив точек.
 * Поддерживает M, L, H, V, Z, а также C, Q, S, T, A —
 * кривые и дуги аппроксимируются контрольными точками (полигональное приближение).
 * Возвращает null только если путь вообще не удалось разобрать.
 */
export function parsePathPoints(d: string): PathPoint[] | null {
  // Разбиваем на команды и числа.
  // Команда — буква, число — с опциональным знаком, точкой, экспонентой.
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
  if (!tokens) return null;

  const points: PathPoint[] = [];
  let i = 0;
  let curX = 0;
  let curY = 0;
  // для S/T: предыдущая контрольная точка
  let lastCtrlX = 0;
  let lastCtrlY = 0;
  // для A: предыдущая команда
  let prevCmd = '';

  function isCommand(token: string): boolean {
    return /^[A-Za-z]$/.test(token);
  }

  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (!isCommand(cmd)) return null;

    switch (cmd) {
      case 'M':
      case 'm': {
        const x = parseFloat(tokens[i++]);
        const y = parseFloat(tokens[i++]);
        if (isNaN(x) || isNaN(y)) return null;
        // относительные координаты
        if (cmd === 'm' && points.length > 0) {
          curX += x; curY += y;
        } else {
          curX = x; curY = y;
        }
        points.push({ x: curX, y: curY, isMove: true });

        // после M могут идти неявные L
        while (i < tokens.length && !isCommand(tokens[i])) {
          const lx = parseFloat(tokens[i++]);
          const ly = parseFloat(tokens[i++]);
          if (isNaN(lx) || isNaN(ly)) return null;
          if (cmd === 'm') {
            curX += lx; curY += ly;
          } else {
            curX = lx; curY = ly;
          }
          points.push({ x: curX, y: curY });
        }
        break;
      }
      case 'L':
      case 'l': {
        while (i < tokens.length && !isCommand(tokens[i])) {
          const x = parseFloat(tokens[i++]);
          const y = parseFloat(tokens[i++]);
          if (isNaN(x) || isNaN(y)) return null;
          if (cmd === 'l') {
            curX += x; curY += y;
          } else {
            curX = x; curY = y;
          }
          points.push({ x: curX, y: curY });
        }
        break;
      }
      case 'H':
      case 'h': {
        while (i < tokens.length && !isCommand(tokens[i])) {
          const x = parseFloat(tokens[i++]);
          if (isNaN(x)) return null;
          if (cmd === 'h') curX += x;
          else curX = x;
          points.push({ x: curX, y: curY });
        }
        break;
      }
      case 'V':
      case 'v': {
        while (i < tokens.length && !isCommand(tokens[i])) {
          const y = parseFloat(tokens[i++]);
          if (isNaN(y)) return null;
          if (cmd === 'v') curY += y;
          else curY = y;
          points.push({ x: curX, y: curY });
        }
        break;
      }
      case 'C':
      case 'c': {
        while (i < tokens.length && !isCommand(tokens[i])) {
          const x1 = parseFloat(tokens[i++]);
          const y1 = parseFloat(tokens[i++]);
          const x2 = parseFloat(tokens[i++]);
          const y2 = parseFloat(tokens[i++]);
          const x  = parseFloat(tokens[i++]);
          const y  = parseFloat(tokens[i++]);
          if ([x1,y1,x2,y2,x,y].some(isNaN)) return null;

          let c1x = x1, c1y = y1, c2x = x2, c2y = y2, ex = x, ey = y;
          if (cmd === 'c') {
            c1x += curX; c1y += curY;
            c2x += curX; c2y += curY;
            ex  += curX; ey  += curY;
          }
          // добавляем контрольные точки как обычные точки полигона
          points.push({ x: c1x, y: c1y });
          points.push({ x: c2x, y: c2y });
          points.push({ x: ex,  y: ey  });
          curX = ex; curY = ey;
          lastCtrlX = c2x; lastCtrlY = c2y;
        }
        break;
      }
      case 'S':
      case 's': {
        while (i < tokens.length && !isCommand(tokens[i])) {
          const x2 = parseFloat(tokens[i++]);
          const y2 = parseFloat(tokens[i++]);
          const x  = parseFloat(tokens[i++]);
          const y  = parseFloat(tokens[i++]);
          if ([x2,y2,x,y].some(isNaN)) return null;

          let c2x = x2, c2y = y2, ex = x, ey = y;
          if (cmd === 's') {
            c2x += curX; c2y += curY;
            ex  += curX; ey  += curY;
          }
          // отражение предыдущей контрольной точки
          const c1x = 2 * curX - lastCtrlX;
          const c1y = 2 * curY - lastCtrlY;

          points.push({ x: c1x, y: c1y });
          points.push({ x: c2x, y: c2y });
          points.push({ x: ex,  y: ey  });
          curX = ex; curY = ey;
          lastCtrlX = c2x; lastCtrlY = c2y;
        }
        break;
      }
      case 'Q':
      case 'q': {
        while (i < tokens.length && !isCommand(tokens[i])) {
          const x1 = parseFloat(tokens[i++]);
          const y1 = parseFloat(tokens[i++]);
          const x  = parseFloat(tokens[i++]);
          const y  = parseFloat(tokens[i++]);
          if ([x1,y1,x,y].some(isNaN)) return null;

          let c1x = x1, c1y = y1, ex = x, ey = y;
          if (cmd === 'q') {
            c1x += curX; c1y += curY;
            ex  += curX; ey  += curY;
          }
          points.push({ x: c1x, y: c1y });
          points.push({ x: ex,  y: ey  });
          curX = ex; curY = ey;
          lastCtrlX = c1x; lastCtrlY = c1y;
        }
        break;
      }
      case 'T':
      case 't': {
        while (i < tokens.length && !isCommand(tokens[i])) {
          const x = parseFloat(tokens[i++]);
          const y = parseFloat(tokens[i++]);
          if ([x,y].some(isNaN)) return null;

          let ex = x, ey = y;
          if (cmd === 't') { ex += curX; ey += curY; }
          const c1x = 2 * curX - lastCtrlX;
          const c1y = 2 * curY - lastCtrlY;
          points.push({ x: c1x, y: c1y });
          points.push({ x: ex,  y: ey  });
          curX = ex; curY = ey;
          lastCtrlX = c1x; lastCtrlY = c1y;
        }
        break;
      }
      case 'A':
      case 'a': {
        while (i < tokens.length && !isCommand(tokens[i])) {
          // rx ry x-axis-rotation large-arc-flag sweep-flag x y
          const rx = parseFloat(tokens[i++]);
          const ry = parseFloat(tokens[i++]);
          const rot = parseFloat(tokens[i++]);
          const large = parseFloat(tokens[i++]);
          const sweep = parseFloat(tokens[i++]);
          const x = parseFloat(tokens[i++]);
          const y = parseFloat(tokens[i++]);
          if ([rx,ry,rot,large,sweep,x,y].some(isNaN)) return null;

          let ex = x, ey = y;
          if (cmd === 'a') { ex += curX; ey += curY; }
          // дугу аппроксимируем одной точкой в конце
          points.push({ x: ex, y: ey });
          curX = ex; curY = ey;
        }
        break;
      }
      case 'Z':
      case 'z': {
        // закрытие — не добавляем точку, флаг closed вычисляется снаружи по /[Zz]/
        break;
      }
      default:
        return null;
    }
    prevCmd = cmd;
  }

  return points;
}
/**
 * Собирает SVG path из массива точек.
 */
export function buildPath(points: PathPoint[], closed = false): string {
  if (!points.length) return '';
  const parts: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    parts.push(`${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  }
  if (closed) parts.push('Z');
  return parts.join(' ');
}

/**
 * Вставляет точку между двумя соседними точками (в середину сегмента).
 */
export function insertPointAt(points: PathPoint[], indexA: number, indexB: number): PathPoint[] {
  const a = points[indexA];
  const b = points[indexB];
  if (!a || !b) return points;
  const mid: PathPoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const result = [...points];
  result.splice(indexA + 1, 0, mid);
  return result;
}
