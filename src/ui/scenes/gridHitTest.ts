export type GridRect = { left: number; top: number };

export type GridMetrics = {
  padding: number;
  cell: number;
  gap: number;
  width: number;
  height: number;
};

export function gridCellFromClient(
  p: { clientX: number; clientY: number },
  rect: GridRect,
  m: GridMetrics,
): { x: number; y: number } | null {
  const stepX = m.cell + m.gap;
  const stepY = m.cell + m.gap;

  const localX = p.clientX - rect.left - m.padding;
  const localY = p.clientY - rect.top - m.padding;
  if (localX < 0 || localY < 0) return null;

  const x = Math.floor(localX / stepX);
  const y = Math.floor(localY / stepY);
  if (x < 0 || y < 0 || x >= m.width || y >= m.height) return null;

  return { x, y };
}

