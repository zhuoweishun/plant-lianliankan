import { genBoard } from "../board/boardGen.ts";
import { canLink, type Point } from "../board/linkPath.ts";
import { makeRng } from "../rng.ts";
import type { GateState, Engine, MatchResult, TerrainGrid, Tile, TileGrid } from "./types.ts";
import type { LevelDef } from "../../data/levels.ts";
import type { MaterialId } from "../../data/materials.ts";

function make2d<T>(width: number, height: number, init: () => T): T[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => init()));
}

function inBounds(width: number, height: number, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height;
}

function terrainGridFromLevel(level: LevelDef): TerrainGrid {
  const grid: TerrainGrid = make2d(level.size.width, level.size.height, () => "normal");
  for (const p of level.blocked ?? []) {
    if (!inBounds(level.size.width, level.size.height, p.x, p.y)) continue;
    grid[p.y]![p.x] = "blocked";
  }
  for (const gate of level.gates ?? []) {
    for (const p of gate.cells) {
      if (!inBounds(level.size.width, level.size.height, p.x, p.y)) continue;
      grid[p.y]![p.x] = "gate";
    }
  }
  return grid;
}

function gateGridFromLevel(level: LevelDef): Array<Array<GateState | null>> {
  const grid = make2d<GateState | null>(level.size.width, level.size.height, () => null);
  for (const gate of level.gates ?? []) {
    const open = gate.initial === "open";
    for (const p of gate.cells) {
      if (!inBounds(level.size.width, level.size.height, p.x, p.y)) continue;
      grid[p.y]![p.x] = { open, group: gate.group };
    }
  }
  return grid;
}

function availablePositions(level: LevelDef, terrain: TerrainGrid): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < level.size.height; y++) {
    for (let x = 0; x < level.size.width; x++) {
      if (terrain[y]![x] === "normal") out.push({ x, y });
    }
  }
  return out;
}

function fillTiles(level: LevelDef, terrain: TerrainGrid, seed: string | number): TileGrid {
  const tiles: TileGrid = make2d(level.size.width, level.size.height, () => null);
  const positions = availablePositions(level, terrain);
  if (positions.length % 2 !== 0) {
    throw new Error(`availableCells must be even, got ${positions.length}`);
  }
  const board = genBoard(
    { width: positions.length, height: 1 },
    { seed, materialIds: level.materialIds, requiredPairs: level.goals },
  );
  const flat = board.grid[0]!;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]!;
    tiles[p.y]![p.x] = { id: flat[i] as MaterialId, lockHits: 0 };
  }
  for (const lock of level.locks ?? []) {
    for (const p of lock.cells) {
      if (!inBounds(level.size.width, level.size.height, p.x, p.y)) continue;
      const tile = tiles[p.y]![p.x];
      if (tile) tile.lockHits = 2;
    }
  }
  return tiles;
}

function groupPointsById(tiles: TileGrid): Map<MaterialId, Point[]> {
  const out = new Map<MaterialId, Point[]>();
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y]!.length; x++) {
      const tile = tiles[y]![x];
      if (!tile) continue;
      const list = out.get(tile.id) ?? [];
      list.push({ x, y });
      out.set(tile.id, list);
    }
  }
  return out;
}

function shuffleInPlace<T>(arr: T[], rngInt: (min: number, max: number) => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rngInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

export function makeEngine(level: LevelDef, opts: { seed: string | number }): Engine {
  const width = level.size.width;
  const height = level.size.height;
  const terrain = terrainGridFromLevel(level);
  const gates = gateGridFromLevel(level);
  const tiles = fillTiles(level, terrain, opts.seed);

  const buildLinkGrid = (): Array<Array<unknown | null>> => {
    const grid = make2d<unknown | null>(width, height, () => null);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y]![x];
        if (tile) {
          grid[y]![x] = tile.id;
          continue;
        }
        const cell = terrain[y]![x];
        if (cell === "blocked") {
          grid[y]![x] = "#";
          continue;
        }
        if (cell === "gate") {
          const gate = gates[y]![x];
          grid[y]![x] = gate && gate.open ? null : "#";
        }
      }
    }
    return grid;
  };

  const isBlocked = (x: number, y: number) => inBounds(width, height, x, y) && terrain[y]![x] === "blocked";
  const isGate = (x: number, y: number) => inBounds(width, height, x, y) && terrain[y]![x] === "gate";
  const isGateOpen = (x: number, y: number) => (isGate(x, y) ? (gates[y]![x]?.open ?? false) : false);
  const getTileId = (x: number, y: number) => (inBounds(width, height, x, y) ? tiles[y]![x]?.id ?? null : null);
  const getLockHits = (x: number, y: number) => (inBounds(width, height, x, y) ? tiles[y]![x]?.lockHits ?? 0 : 0);

  const toggleGates = () => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gate = gates[y]![x];
        if (!gate) continue;
        gate.open = !gate.open;
      }
    }
  };

  const applyShift = (force?: { axis: "row" | "col"; index: number; step: 1 | 2 }) => {
    const spec = level.shift;
    if (!spec && !force) return;
    const rng = makeRng(`${level.id}-shift-${Date.now()}`);
    const axis =
      force?.axis ??
      (spec!.afterMatch === "row-random" ? "row" : rng.int(0, 2) === 0 ? "row" : "col");
    const index = force?.index ?? (axis === "row" ? rng.int(0, height) : rng.int(0, width));
    const step = force?.step ?? spec!.step;

    const coords: Point[] = [];
    if (axis === "row") {
      for (let x = 0; x < width; x++) {
        if (terrain[index]![x] === "normal") coords.push({ x, y: index });
      }
    } else {
      for (let y = 0; y < height; y++) {
        if (terrain[y]![index] === "normal") coords.push({ x: index, y });
      }
    }
    if (coords.length <= 1) return;
    const amount = step % coords.length;
    if (amount === 0) return;
    const before = coords.map((p) => tiles[p.y]![p.x]);
    for (let i = 0; i < coords.length; i++) {
      const from = (i - amount + coords.length) % coords.length;
      const p = coords[i]!;
      tiles[p.y]![p.x] = before[from] ?? null;
    }
  };

  const onAfterSuccessfulMatch = () => {
    if (level.gates?.length) toggleGates();
    if (level.shift) applyShift();
  };

  const tryMatch = (a: Point, b: Point): MatchResult => {
    if (!inBounds(width, height, a.x, a.y) || !inBounds(width, height, b.x, b.y)) {
      return { matched: false, drops: [], removed: false };
    }
    const ta = tiles[a.y]![a.x];
    const tb = tiles[b.y]![b.x];
    if (!ta || !tb || ta.id !== tb.id) return { matched: false, drops: [], removed: false };
    if (!canLink(buildLinkGrid(), a, b)) return { matched: false, drops: [], removed: false };

    if (ta.lockHits > 1 || tb.lockHits > 1) {
      if (ta.lockHits > 1) ta.lockHits = 1;
      if (tb.lockHits > 1) tb.lockHits = 1;
      onAfterSuccessfulMatch();
      return { matched: true, drops: [], removed: false };
    }

    tiles[a.y]![a.x] = null;
    tiles[b.y]![b.x] = null;
    onAfterSuccessfulMatch();
    return { matched: true, drops: [ta.id], removed: true };
  };

  const hasAnyMove = () => {
    const grouped = groupPointsById(tiles);
    const linkGrid = buildLinkGrid();
    for (const [, points] of grouped) {
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          if (canLink(linkGrid, points[i]!, points[j]!)) return true;
        }
      }
    }
    return false;
  };

  const findHintPair = () => {
    const grouped = groupPointsById(tiles);
    const linkGrid = buildLinkGrid();
    for (const [, points] of grouped) {
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i]!;
          const b = points[j]!;
          if (canLink(linkGrid, a, b)) return { a, b };
        }
      }
    }
    return null;
  };

  const reshuffle = (seed: string | number): boolean => {
    const positions = availablePositions(level, terrain);
    const bag = positions.map((p) => tiles[p.y]![p.x]).filter((tile): tile is Tile => tile !== null);
    if (bag.length < 2) return false;
    const rng = makeRng(`${seed}`);

    for (let attempt = 0; attempt < 60; attempt++) {
      const copy = bag.map((tile) => ({ ...tile }));
      shuffleInPlace(copy, rng.int);
      for (let i = 0; i < positions.length; i++) {
        const p = positions[i]!;
        tiles[p.y]![p.x] = copy[i] ?? null;
      }
      if (hasAnyMove()) return true;
    }
    return hasAnyMove();
  };

  const debugSetTile = (x: number, y: number, id: MaterialId, lockHits: 0 | 1 | 2) => {
    if (!inBounds(width, height, x, y)) return;
    if (terrain[y]![x] !== "normal") return;
    tiles[y]![x] = { id, lockHits };
  };

  return {
    level,
    tiles,
    buildLinkGrid,
    isBlocked,
    isGate,
    isGateOpen,
    getTileId,
    getLockHits,
    tryMatch,
    onAfterSuccessfulMatch,
    applyShift,
    reshuffle,
    hasAnyMove,
    findHintPair,
    debugSetTile,
  };
}
