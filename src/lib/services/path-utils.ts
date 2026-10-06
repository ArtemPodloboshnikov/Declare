export function pathToRings(path: string, samples = 300): [number, number][][] {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.visibility = 'hidden';
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', path);
  svg.appendChild(p);
  document.body.appendChild(svg);

  try {
    const total = p.getTotalLength();
    if (!total || total < 0.01) return [];
    const ring: [number, number][] = [];
    for (let i = 0; i < samples; i++) {
      const pt = p.getPointAtLength((i / samples) * total);
      ring.push([pt.x, pt.y]);
    }
    ring.push(ring[0]);   // замкнуть
    return [ring];
  } finally {
    document.body.removeChild(svg);
  }
}

export function ringsToPath(multiPolygon: [number, number][][][]): string {
  const parts: string[] = [];

  for (const polygon of multiPolygon) {
    for (const ring of polygon) {
      if (ring.length < 3) continue;
      const [first, ...rest] = ring;
      parts.push(
        `M ${first[0].toFixed(2)} ${first[1].toFixed(2)} ` +
        rest.map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') +
        ' Z'
      );
    }
  }

  return parts.join(' ');
}

/**
 * Аппроксимирует путь в массив колец, СРАЗУ применяя трансформ
 * из position в пиксели канваса.
 */
export function pathWithTransformToRings(
  path: string,
  position: { x: number; y: number; width: number; height: number },
  samples = 300
): [number, number][][] {
  const sx = position.width / 100;
  const sy = position.height / 100;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.visibility = 'hidden';
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', path);
  svg.appendChild(p);
  document.body.appendChild(svg);

  try {
    const total = p.getTotalLength();
    if (!total || total < 0.01) return [];
    const ring: [number, number][] = [];
    for (let i = 0; i < samples; i++) {
      const pt = p.getPointAtLength((i / samples) * total);
      // ВРУЧНУЮ применяем трансформ
      ring.push([
        pt.x * sx + position.x,
        pt.y * sy + position.y
      ]);
    }
    ring.push(ring[0]);
    return [ring];
  } finally {
    document.body.removeChild(svg);
  }
}
