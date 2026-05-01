import type { MaterialId } from "../../data/materials.ts";
import type { GateGroup, LevelDef, Point } from "../../data/levels.ts";

export type Tile = {
  id: MaterialId;
  lockHits: 0 | 1 | 2;
};

export type TileGrid = Array<Array<Tile | null>>;
export type TerrainCell = "normal" | "blocked" | "gate";
export type TerrainGrid = Array<Array<TerrainCell>>;
export type GateGrid = Array<Array<GateState | null>>;

export type GateState = {
  open: boolean;
  group?: GateGroup;
};

export type ShiftSpec = NonNullable<LevelDef["shift"]>;

export type EngineOptions = {
  seed: string | number;
};

export type MatchResult = {
  matched: boolean;
  drops: MaterialId[];
  removed: boolean;
};

export type HintPair = {
  a: Point;
  b: Point;
};

export type Engine = {
  readonly level: LevelDef;
  readonly tiles: TileGrid;
  buildLinkGrid(): Array<Array<unknown | null>>;
  isBlocked(x: number, y: number): boolean;
  isGate(x: number, y: number): boolean;
  isGateOpen(x: number, y: number): boolean;
  getTileId(x: number, y: number): MaterialId | null;
  getLockHits(x: number, y: number): 0 | 1 | 2;
  tryMatch(a: Point, b: Point): MatchResult;
  onAfterSuccessfulMatch(): void;
  applyShift(force?: { axis: "row" | "col"; index: number; step: 1 | 2 }): void;
  reshuffle(seed: string | number): boolean;
  hasAnyMove(): boolean;
  findHintPair(): HintPair | null;
  debugSetTile(x: number, y: number, id: MaterialId, lockHits: 0 | 1 | 2): void;
};
