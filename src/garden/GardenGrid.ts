export type GardenSize = { width: number; height: number };

export type GardenPlacement<TDecorationId extends string = string> = {
  id: TDecorationId;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type GardenGridJSON<TDecorationId extends string = string> = {
  width: number;
  height: number;
  placements: Array<GardenPlacement<TDecorationId>>;
};

function assertIntInRange(n: number, name: string, minInclusive: number, maxExclusive?: number): void {
  if (!Number.isInteger(n)) throw new Error(`${name} must be an integer`);
  if (n < minInclusive) throw new Error(`${name} must be >= ${minInclusive}`);
  if (maxExclusive !== undefined && n >= maxExclusive) throw new Error(`${name} must be < ${maxExclusive}`);
}

function assertPositiveInt(n: number, name: string): void {
  assertIntInRange(n, name, 1);
}

/**
 * Garden grid with rectangular, cell-occupying placements.
 *
 * Coordinates:
 * - x in [0, width)
 * - y in [0, height)
 * - w/h in positive integers
 */
export class GardenGrid<TDecorationId extends string = string> {
  readonly width: number;
  readonly height: number;

  private readonly occupied: boolean[][];
  private readonly placements: Array<GardenPlacement<TDecorationId>> = [];

  constructor(size: GardenSize, initialPlacements: Array<GardenPlacement<TDecorationId>> = []) {
    assertPositiveInt(size.width, "size.width");
    assertPositiveInt(size.height, "size.height");
    this.width = size.width;
    this.height = size.height;

    this.occupied = [];
    for (let y = 0; y < this.height; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < this.width; x++) row.push(false);
      this.occupied.push(row);
    }

    for (const p of initialPlacements) {
      this.addExistingPlacement(p);
    }
  }

  listPlacements(): ReadonlyArray<GardenPlacement<TDecorationId>> {
    return this.placements;
  }

  /**
   * Find the placement index that occupies the given cell.
   * Returns null if none.
   */
  findPlacementIndexAt(x: number, y: number): number | null {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;

    // Walk backwards to mimic "topmost last" semantics (newer placements are on top).
    for (let i = this.placements.length - 1; i >= 0; i--) {
      const p = this.placements[i]!;
      if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return i;
    }
    return null;
  }

  canPlace(x: number, y: number, w: number, h: number): boolean {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(w) || !Number.isInteger(h)) return false;
    if (w <= 0 || h <= 0) return false;
    if (x < 0 || y < 0) return false;
    if (x + w > this.width || y + h > this.height) return false;

    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (this.occupied[yy]![xx]!) return false;
      }
    }
    return true;
  }

  /**
   * Place a decoration if space is available; otherwise throws.
   * @returns the placed record.
   */
  place(id: TDecorationId, x: number, y: number, w: number, h: number): GardenPlacement<TDecorationId> {
    assertIntInRange(x, "x", 0, this.width);
    assertIntInRange(y, "y", 0, this.height);
    assertPositiveInt(w, "w");
    assertPositiveInt(h, "h");

    if (!this.canPlace(x, y, w, h)) {
      throw new Error(`cannot place at (${x},${y}) size ${w}x${h}`);
    }

    const p: GardenPlacement<TDecorationId> = { id, x, y, w, h };
    this.writeOccupied(p, true);
    this.placements.push(p);
    return p;
  }

  /**
   * Remove a placement by index.
   * @returns the removed placement.
   */
  remove(index: number): GardenPlacement<TDecorationId> {
    assertIntInRange(index, "index", 0, this.placements.length);
    const p = this.placements[index]!;
    this.writeOccupied(p, false);
    this.placements.splice(index, 1);
    return { ...p };
  }

  /**
   * Move a placement by index to a new (x,y) top-left position.
   * - Returns false if out of bounds or would overlap with other placements.
   * - On success, returns true and updates occupancy.
   */
  move(index: number, x: number, y: number): boolean {
    assertIntInRange(index, "index", 0, this.placements.length);
    assertIntInRange(x, "x", 0, this.width);
    assertIntInRange(y, "y", 0, this.height);

    const p = this.placements[index]!;

    // Temporarily clear old occupancy so canPlace ignores self.
    this.writeOccupied(p, false);
    const ok = this.canPlace(x, y, p.w, p.h);
    if (!ok) {
      this.writeOccupied(p, true);
      return false;
    }

    // Apply new position
    p.x = x;
    p.y = y;
    this.writeOccupied(p, true);
    return true;
  }

  /**
   * Like move(), but does not mutate state.
   */
  canMove(index: number, x: number, y: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.placements.length) return false;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;

    const p = this.placements[index]!;
    this.writeOccupied(p, false);
    const ok = this.canPlace(x, y, p.w, p.h);
    this.writeOccupied(p, true);
    return ok;
  }

  toJSON(): GardenGridJSON<TDecorationId> {
    return {
      width: this.width,
      height: this.height,
      placements: this.placements.map((p) => ({ ...p })),
    };
  }

  static fromJSON<TDecorationId extends string = string>(json: GardenGridJSON<TDecorationId>): GardenGrid<TDecorationId> {
    if (json === null || typeof json !== "object" || Array.isArray(json)) {
      throw new Error("GardenGrid.fromJSON expects an object");
    }
    const { width, height, placements } = json;
    if (!Array.isArray(placements)) throw new Error("GardenGrid.fromJSON expects placements array");
    return new GardenGrid<TDecorationId>({ width, height }, placements);
  }

  private addExistingPlacement(p: GardenPlacement<TDecorationId>): void {
    // Validate shape
    assertIntInRange(p.x, "placement.x", 0, this.width);
    assertIntInRange(p.y, "placement.y", 0, this.height);
    assertPositiveInt(p.w, "placement.w");
    assertPositiveInt(p.h, "placement.h");

    if (!this.canPlace(p.x, p.y, p.w, p.h)) {
      throw new Error(`invalid placement overlap/out of bounds: (${p.x},${p.y}) ${p.w}x${p.h}`);
    }

    this.writeOccupied(p, true);
    this.placements.push({ ...p });
  }

  private writeOccupied(p: GardenPlacement<TDecorationId>, value: boolean): void {
    for (let yy = p.y; yy < p.y + p.h; yy++) {
      for (let xx = p.x; xx < p.x + p.w; xx++) {
        this.occupied[yy]![xx] = value;
      }
    }
  }
}
