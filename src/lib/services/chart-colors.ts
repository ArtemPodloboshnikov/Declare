export const DEFAULT_CHART_COLORS = [
  '#7c6cf0',
  '#60a5fa',
  '#4ade80',
  '#fbbf24',
  '#f87171',
  '#f472b6',
  '#a78bfa',
  '#94a3b8'
];

export function colorFor(index: number): string {
  return DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length];
}

export function ensureColors(count: number, existing?: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(existing?.[i] ?? colorFor(i));
  }
  return result;
}
