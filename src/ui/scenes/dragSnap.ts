export type CellPoint = { x: number; y: number };

export type CellSize = { w: number; h: number };

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Convert a hovered grid cell (the cell under cursor/finger) and the grab offset
 * (which cell within the object you grabbed) into the object's top-left cell.
 *
 * Example: you grabbed a 2x1 bench on its right cell => grabOffset.x = 1.
 * When hovering over cell (5,2), top-left should be (4,2).
 */
export function topLeftFromHover(hover: CellPoint, grabOffset: CellPoint): CellPoint {
  return { x: hover.x - grabOffset.x, y: hover.y - grabOffset.y };
}

/**
 * Clamp an object's top-left cell so the rectangle stays inside the grid.
 * This is important for *rendering* previews in CSS grid, otherwise negative
 * lines or out-of-range spans can create implicit tracks and visually resize the grid.
 */
export function clampTopLeftToGrid(at: CellPoint, size: CellSize, grid: CellSize): CellPoint {
  const maxX = grid.w - size.w;
  const maxY = grid.h - size.h;
  return { x: clamp(at.x, 0, maxX), y: clamp(at.y, 0, maxY) };
}
