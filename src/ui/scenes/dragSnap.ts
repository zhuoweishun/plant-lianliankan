export type CellPoint = { x: number; y: number };

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

