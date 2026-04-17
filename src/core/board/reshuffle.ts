import { makeRng } from "../rng.ts";
import { canLink, type Point } from "./linkPath.ts";

export type Grid<T extends string | number> = Array<Array<T | null>>;

function shuffleInPlace<T>(arr: T[], rngInt: (min: number, max: number) => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rngInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

export function hasAnyLinkablePair<T extends string | number>(grid: Grid<T>): boolean {
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
        if (canLink(grid, pts[i]!, pts[j]!)) return true;
      }
    }
  }
  return false;
}

export function reshuffleGrid<T extends string | number>(
  grid: Grid<T>,
  opts: { seed: string | number; maxTries?: number } = { seed: 1 },
): Grid<T> | null {
  if (grid.length === 0) return grid;

  const h = grid.length;
  const w = grid[0]!.length;

  // Collect tiles + record null slots
  const tiles: T[] = [];
  const isNull: boolean[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = grid[y]![x];
      isNull.push(v === null);
      if (v !== null) tiles.push(v);
    }
  }

  if (tiles.length < 2) return null;

  const rng = makeRng(`${opts.seed}`);
  const bag = [...tiles];
  shuffleInPlace(bag, rng.int);

  const out: Grid<T> = [];
  let k = 0;
  let idx = 0;
  for (let y = 0; y < h; y++) {
    const row: Array<T | null> = [];
    for (let x = 0; x < w; x++) {
      const nullHere = isNull[idx++]!;
      if (nullHere) row.push(null);
      else row.push(bag[k++] ?? null);
    }
    out.push(row);
  }

  if (hasAnyLinkablePair(out)) return out;

  // Guarantee at least one "easy" move by forcing an adjacent identical pair.
  // This avoids heavy retries and makes the UI feel responsive.
  const dirs = [
    [1, 0],
    [0, 1],
  ] as const;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = out[y]![x];
      if (v === null) continue;
      // Find another same tile somewhere (p3)
      let p3: { x: number; y: number } | null = null;
      for (let yy = 0; yy < h && !p3; yy++) {
        for (let xx = 0; xx < w; xx++) {
          if (xx === x && yy === y) continue;
          if (out[yy]![xx] === v) {
            p3 = { x: xx, y: yy };
            break;
          }
        }
      }
      if (!p3) continue;

      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (out[ny]![nx] === null) continue;
        if (nx === p3.x && ny === p3.y) continue;
        // Swap neighbor with p3 so (x,y) and (nx,ny) become identical.
        const tmp = out[ny]![nx];
        out[ny]![nx] = out[p3.y]![p3.x];
        out[p3.y]![p3.x] = tmp ?? null;
        return out;
      }
    }
  }

  // Worst case: return the shuffled board even if still no moves.
  return out;
}
