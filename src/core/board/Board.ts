export type BoardSize = { width: number; height: number };

/**
 * A board grid is indexed as `grid[y][x]`.
 *
 * In "连连看" style games, cells may become empty as the game progresses, so
 * `null` represents an empty cell.
 */
export type BoardGrid<TMaterialId extends string | number> = Array<
  Array<TMaterialId | null>
>;

export class Board<TMaterialId extends string | number> {
  readonly width: number;
  readonly height: number;
  readonly grid: BoardGrid<TMaterialId>;

  constructor(size: BoardSize, grid: BoardGrid<TMaterialId>) {
    if (!Number.isInteger(size.width) || !Number.isInteger(size.height)) {
      throw new Error("Board size must be integers");
    }
    if (size.width <= 0 || size.height <= 0) {
      throw new Error("Board size must be positive");
    }
    if (grid.length !== size.height) {
      throw new Error("Grid height does not match size.height");
    }
    for (let y = 0; y < size.height; y++) {
      const row = grid[y];
      if (!row || row.length !== size.width) {
        throw new Error("Grid width does not match size.width");
      }
    }

    this.width = size.width;
    this.height = size.height;
    this.grid = grid;
  }

  get(x: number, y: number): TMaterialId | null {
    return this.grid[y]![x] ?? null;
  }
}

