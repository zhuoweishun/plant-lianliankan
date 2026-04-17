import type { Seed } from "../types.ts";
import { makeRng } from "../rng.ts";
import { Board, type BoardSize, type BoardGrid } from "./Board.ts";

export type GenBoardOptions<TMaterialId extends string | number> = {
  seed: Seed;
  materialIds: readonly TMaterialId[];
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
  for (let i = 0; i < pairs; i++) {
    const id = materialIds[rng.int(0, materialIds.length)]!;
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

