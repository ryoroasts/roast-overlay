// プロファイルへの色割り当て
export const PALETTE = [
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#10b981', // emerald
  '#ef4444', // red
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#eab308', // yellow
];

export function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
