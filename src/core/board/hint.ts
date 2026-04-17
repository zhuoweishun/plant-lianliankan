import { canLink, type Point } from "./linkPath.ts";

export type Grid<T extends string | number> = Array<Array<T | null>>;

export function findAnyLinkablePair<T extends string | number>(
  grid: Grid<T>,
): { a: Point; b: Point } | null {
  const pointsById = new Map<T, Point[]>();
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]!;
    for (let x = 0; x < row.length; x++) {
      const v = row[x];
      if (v === null) continue;
      const list = pointsById.get(v) ?? [];
      list.push({ x, y });
      pointsById.set(v, list);
    }
  }

  for (const [, pts] of pointsById) {
    if (pts.length < 2) continue;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]!;
        const b = pts[j]!;
        if (canLink(grid, a, b)) return { a, b };
      }
    }
  }
  return null;
}

