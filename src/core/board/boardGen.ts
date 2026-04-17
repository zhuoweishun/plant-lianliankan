import type { Seed } from "../types.ts";
import { makeRng } from "../rng.ts";
import { Board, type BoardSize, type BoardGrid } from "./Board.ts";

export type GenBoardOptions<TMaterialId extends string | number> = {
  seed: Seed;
  materialIds: readonly TMaterialId[];
  /**
   * Force exact pair counts for some materials.
   *
   * Example: requiredPairs: { bench: 3 } means the board will contain exactly
   * 3 pairs (6 tiles) of "bench" (unless "bench" is the only available id).
   */
  requiredPairs?: Partial<Record<string, number>>;
};

function shuffleInPlace<T>(arr: T[], rngInt: (min: number, max: number) => number): void {
  // Fisher–Yates shuffle (deterministic given rngInt).
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rngInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/**
 * Generate a fully-filled board where every material appears an even number
 * of times (tiles come in pairs).
 */
export function genBoard<TMaterialId extends string | number>(
  size: BoardSize,
  options: GenBoardOptions<TMaterialId>,
): Board<TMaterialId> {
  if (!Number.isInteger(size.width) || !Number.isInteger(size.height)) {
    throw new Error("size.width/size.height must be integers");
  }
  if (size.width <= 0 || size.height <= 0) {
    throw new Error("size.width/size.height must be positive");
  }

  const total = size.width * size.height;
  if (total % 2 !== 0) {
    throw new Error("Board cell count must be even");
  }

  const { seed, materialIds } = options;
  if (materialIds.length === 0) {
    throw new Error("materialIds must not be empty");
  }

  const rng = makeRng(seed);

  const tiles: TMaterialId[] = [];
  const pairs = total / 2;

  const required = options.requiredPairs ?? {};
  const requiredKeys = Object.keys(required);
  const materialSet = new Set(materialIds.map((x) => String(x)));

  let requiredPairTotal = 0;
  for (const k of requiredKeys) {
    if (!materialSet.has(k)) {
      throw new Error(`requiredPairs contains unknown materialId: ${k}`);
    }
    const v = required[k];
    if (v === undefined) continue;
    if (!Number.isInteger(v) || v < 0) {
      throw new Error(`requiredPairs(${k}) must be a non-negative integer`);
    }
    requiredPairTotal += v;
  }
  if (requiredPairTotal > pairs) {
    throw new Error(`requiredPairs total (${requiredPairTotal}) exceeds board capacity (${pairs})`);
  }

  // Add forced pairs first
  for (const k of requiredKeys) {
    const v = required[k];
    if (!v) continue;
    const id = materialIds.find((x) => String(x) === k)!;
    for (let i = 0; i < v; i++) tiles.push(id, id);
  }

  // Fill the rest with a pool that excludes required ids (so "required" is exact)
  const requiredKeySet = new Set(requiredKeys.filter((k) => (required[k] ?? 0) > 0));
  const extraPool = materialIds.filter((id) => !requiredKeySet.has(String(id)));
  const pool = extraPool.length > 0 ? extraPool : materialIds;

  for (let i = requiredPairTotal; i < pairs; i++) {
    const id = pool[rng.int(0, pool.length)]!;
    tiles.push(id, id);
  }

  shuffleInPlace(tiles, rng.int);

  const grid: BoardGrid<TMaterialId> = [];
  let idx = 0;
  for (let y = 0; y < size.height; y++) {
    const row: Array<TMaterialId | null> = [];
    for (let x = 0; x < size.width; x++) {
      row.push(tiles[idx++] ?? null);
    }
    grid.push(row);
  }

  return new Board<TMaterialId>(size, grid);
}
