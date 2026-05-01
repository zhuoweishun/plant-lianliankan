import { MATERIALS, getMaterialName, type MaterialId } from "./materials.ts";

const MAIN_LEVEL_IDS = Array.from({ length: 50 }, (_, i) => `L${i + 1}`) as readonly `L${number}`[];

type MainLevelId = (typeof MAIN_LEVEL_IDS)[number];
export type LevelId = MainLevelId | "T1";
export type LevelKind = "main" | "test";
export type LevelDifficulty = 1 | 2 | 3 | 4 | 5;
export type Point = { x: number; y: number };
export type GateGroup = "A" | "B";

export type LevelGateDef = {
  cells: readonly Point[];
  initial: "open" | "closed";
  toggle: "afterMatch";
  group?: GateGroup;
};

export type LevelLockDef = {
  cells: readonly Point[];
  hits: 2;
};

export type LevelShiftDef = {
  afterMatch: "row-random" | "rowcol-random";
  step: 1 | 2;
  blockedStatic: true;
};

export type LevelDef = {
  id: LevelId;
  order: number;
  kind: LevelKind;
  chapter: number;
  difficulty: LevelDifficulty;
  name: string;
  size: { width: number; height: number };
  materialIds: readonly MaterialId[];
  goals: Partial<Record<MaterialId, number>>;
  blocked?: readonly Point[];
  gates?: readonly LevelGateDef[];
  locks?: readonly LevelLockDef[];
  shift?: LevelShiftDef;
  notes?: string;
};

const ALL_MATERIAL_IDS = MATERIALS.map((material) => material.id) as readonly MaterialId[];
const EARLY_MATERIAL_IDS = ["wood", "stone"] as const satisfies readonly MaterialId[];
const MID_MATERIAL_IDS = ["wood", "stone", "leaf"] as const satisfies readonly MaterialId[];

function pointKey(p: Point): string {
  return `${p.x},${p.y}`;
}

function uniquePoints(points: readonly Point[]): Point[] {
  const seen = new Set<string>();
  const out: Point[] = [];
  for (const p of points) {
    const k = pointKey(p);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function containsPoint(points: readonly Point[], x: number, y: number): boolean {
  return points.some((p) => p.x === x && p.y === y);
}

function getChapter(order: number): number {
  return Math.ceil(order / 10);
}

function getStage(order: number): number {
  return ((order - 1) % 10) + 1;
}

function getDifficultyForLevel(order: number): LevelDifficulty {
  if (order <= 10) return 1;
  if (order <= 20) return 2;
  if (order <= 30) return 3;
  if (order <= 40) return 4;
  return 5;
}

function getBoardSizeForLevel(order: number): LevelDef["size"] {
  if (order <= 2) return { width: 8, height: 6 };
  if (order <= 5) return { width: 10, height: 6 };
  if (order <= 10) return { width: 10, height: 8 };
  if (order <= 20) return { width: 12, height: 8 };
  if (order <= 30) return { width: 12, height: 10 };
  if (order <= 40) return { width: 14, height: 10 };
  return { width: 14, height: 12 };
}

function getMaterialIdsForLevel(order: number): readonly MaterialId[] {
  if (order <= 3) return EARLY_MATERIAL_IDS;
  if (order <= 10) return MID_MATERIAL_IDS;
  return ALL_MATERIAL_IDS;
}

function centeredXs(width: number, count: number): number[] {
  const xs: number[] = [];
  const start = Math.max(1, Math.floor((width - count) / 2));
  for (let i = 0; i < count; i++) xs.push(start + i);
  return xs;
}

function blockedForLevel(order: number, size: LevelDef["size"]): Point[] {
  if (order <= 10) return [];
  const chapter = getChapter(order);
  const stage = getStage(order);
  const { width: w, height: h } = size;
  const points: Point[] = [];

  const yA = Math.floor(h / 2);
  const yB = Math.max(1, Math.floor(h / 3));
  const yC = Math.min(h - 2, Math.floor((h * 2) / 3));

  const primaryLen =
    chapter === 2
      ? stage <= 3
        ? 2
        : stage <= 6
          ? 4
          : 6
      : chapter === 3
        ? stage <= 3
          ? 4
          : stage <= 6
            ? 6
            : 8
        : chapter === 4
          ? stage <= 3
            ? 6
            : stage <= 6
              ? 8
              : 10
          : stage <= 3
            ? 8
            : stage <= 6
              ? 10
              : 12;

  for (const x of centeredXs(w, Math.min(primaryLen, w - 2))) points.push({ x, y: yA });

  if (chapter >= 3) {
    const secondaryLen =
      chapter === 3 ? (stage <= 5 ? 2 : 4) : chapter === 4 ? (stage <= 5 ? 4 : 6) : stage <= 5 ? 6 : 8;
    for (const x of centeredXs(w, Math.min(secondaryLen, w - 4))) {
      points.push({ x, y: yB });
      points.push({ x, y: yC });
    }
  }

  const uniq = uniquePoints(points);
  if (uniq.length % 2 === 1) uniq.pop();
  return uniq;
}

function gateCandidates(size: LevelDef["size"], blocked: readonly Point[]): { a: Point[]; b: Point[] } {
  const { width: w, height: h } = size;
  const colA = Math.max(1, Math.floor(w / 2) - 1);
  const colB = Math.min(w - 2, colA + 2);
  const a: Point[] = [];
  const b: Point[] = [];
  for (let y = 1; y < h - 1; y += 2) {
    if (!containsPoint(blocked, colA, y)) a.push({ x: colA, y });
  }
  for (let y = 2; y < h - 1; y += 2) {
    if (!containsPoint(blocked, colB, y)) b.push({ x: colB, y });
  }
  return { a, b };
}

function gatesForLevel(order: number, size: LevelDef["size"], blocked: readonly Point[]): LevelGateDef[] {
  if (order <= 20) return [];
  const stage = getStage(order);
  const { a, b } = gateCandidates(size, blocked);
  const raw: LevelGateDef[] =
    stage <= 4
      ? [{ cells: a.slice(0, 2), initial: "open", toggle: "afterMatch" }]
      : stage <= 7
        ? [
            { cells: a.slice(0, 2), initial: "open", toggle: "afterMatch", group: "A" },
            { cells: b.slice(0, 2), initial: "closed", toggle: "afterMatch", group: "B" },
          ]
        : [
            { cells: a.slice(0, 3), initial: "open", toggle: "afterMatch", group: "A" },
            { cells: b.slice(0, 3), initial: "closed", toggle: "afterMatch", group: "B" },
          ];

  const total = raw.reduce((n, gate) => n + gate.cells.length, 0);
  if (total % 2 === 0) return raw;

  const last = raw[raw.length - 1]!;
  return [
    ...raw.slice(0, -1),
    {
      ...last,
      cells: last.cells.slice(0, Math.max(0, last.cells.length - 1)),
    },
  ];
}

function locksForLevel(
  order: number,
  size: LevelDef["size"],
  blocked: readonly Point[],
  gates: readonly LevelGateDef[],
): LevelLockDef[] {
  if (order <= 30) return [];
  const stage = getStage(order);
  const chapter = getChapter(order);
  const gatePoints = uniquePoints(gates.flatMap((g) => g.cells));
  const allTerrain = new Set([...blocked.map(pointKey), ...gatePoints.map(pointKey)]);
  const { width: w, height: h } = size;
  const count = chapter === 4 ? (stage <= 4 ? 4 : stage <= 7 ? 6 : 8) : stage <= 4 ? 6 : stage <= 7 ? 8 : 10;
  const cells: Point[] = [];
  for (let y = 1; y < h - 1 && cells.length < count; y++) {
    for (let x = 1; x < w - 1 && cells.length < count; x++) {
      if (allTerrain.has(`${x},${y}`)) continue;
      cells.push({ x, y });
    }
  }
  return cells.length > 0 ? [{ cells, hits: 2 }] : [];
}

function shiftForLevel(order: number): LevelShiftDef | undefined {
  if (order <= 40) return undefined;
  if (order <= 44) return { afterMatch: "row-random", step: 1, blockedStatic: true };
  if (order <= 47) return { afterMatch: "rowcol-random", step: 1, blockedStatic: true };
  return { afterMatch: "rowcol-random", step: 2, blockedStatic: true };
}

function availablePairsFor(size: LevelDef["size"], blocked: readonly Point[], gates: readonly LevelGateDef[]): number {
  const gateCells = new Set(gates.flatMap((g) => g.cells.map(pointKey)));
  return Math.floor((size.width * size.height - blocked.length - gateCells.size) / 2);
}

function getGoalsForLevel(
  order: number,
  materialIds: readonly MaterialId[],
  capacityPairs: number,
): LevelDef["goals"] {
  const chapter = getChapter(order);
  const stage = getStage(order);
  const slots = chapter === 1 ? (stage <= 3 ? 1 : 2) : chapter <= 3 ? 2 : 3;
  const primary = 4 + chapter * 2 + Math.floor(stage / 2);
  const secondary = 2 + Math.floor(stage / 3);
  const tertiary = 2 + (stage % 2);
  const goals: Partial<Record<MaterialId, number>> = {};

  const candidates = slots === 1 ? [primary] : slots === 2 ? [primary, secondary] : [primary, secondary, tertiary];
  const maxAllowed = Math.max(2, Math.floor(capacityPairs * 0.6));
  let remaining = maxAllowed;

  for (let i = 0; i < slots; i++) {
    const id = materialIds[i % materialIds.length]!;
    const want = Math.max(2, Math.min(candidates[i]!, remaining - (slots - i - 1) * 2));
    const clamped = Math.min(want, remaining);
    if (clamped <= 0) continue;
    goals[id] = clamped;
    remaining -= clamped;
  }

  return goals;
}

function getNotesForLevel(order: number): string | undefined {
  if (order <= 10) return undefined;
  if (order <= 20) return "引入封印石：不可放 tile、不可点击、路径不可穿过。";
  if (order <= 30) return "引入藤蔓门：每次成功消除后切换开合，改变可通行路径。";
  if (order <= 40) return "引入锁链贴：带锁链的 tile 需要消两次，第一次只破锁不掉落。";
  return "引入风吹移位：每次成功消除后随机行/列循环平移，地形固定不动。";
}

function getNameForLevel(order: number, goals: LevelDef["goals"]): string {
  const primaryGoalId = Object.keys(goals)[0] as MaterialId | undefined;
  const primaryGoalName = primaryGoalId ? getMaterialName(primaryGoalId) : "材料";
  return `第 ${order} 关：${primaryGoalName}收集`;
}

function createMainLevel(id: MainLevelId, index: number): LevelDef {
  const order = index + 1;
  const size = getBoardSizeForLevel(order);
  const materialIds = getMaterialIdsForLevel(order);
  const blocked = blockedForLevel(order, size);
  const gates = gatesForLevel(order, size, blocked);
  const locks = locksForLevel(order, size, blocked, gates);
  const shift = shiftForLevel(order);
  const goals = getGoalsForLevel(order, materialIds, availablePairsFor(size, blocked, gates));

  return {
    id,
    order,
    kind: "main",
    chapter: getChapter(order),
    difficulty: getDifficultyForLevel(order),
    name: getNameForLevel(order, goals),
    size,
    materialIds,
    goals,
    ...(blocked.length > 0 ? { blocked } : {}),
    ...(gates.length > 0 ? { gates } : {}),
    ...(locks.length > 0 ? { locks } : {}),
    ...(shift ? { shift } : {}),
    ...(getNotesForLevel(order) ? { notes: getNotesForLevel(order) } : {}),
  };
}

export const MAIN_LEVELS: readonly LevelDef[] = MAIN_LEVEL_IDS.map((id, index) => createMainLevel(id, index));

export const LEVELS: readonly LevelDef[] = [
  ...MAIN_LEVELS,
  {
    id: "T1",
    order: 0,
    kind: "test",
    chapter: 0,
    difficulty: 5,
    name: "测试关：四机制压力测试",
    size: { width: 14, height: 10 },
    materialIds: ALL_MATERIAL_IDS,
    goals: { wood: 12, stone: 10, water: 10, leaf: 8 },
    blocked: [
      { x: 1, y: 4 },
      { x: 2, y: 4 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 9, y: 4 },
      { x: 10, y: 4 },
      { x: 11, y: 4 },
      { x: 12, y: 4 },
      { x: 6, y: 7 },
      { x: 7, y: 7 },
    ],
    gates: [
      { cells: [{ x: 5, y: 1 }, { x: 5, y: 3 }, { x: 5, y: 5 }], initial: "open", toggle: "afterMatch", group: "A" },
      { cells: [{ x: 8, y: 2 }, { x: 8, y: 4 }, { x: 8, y: 6 }], initial: "closed", toggle: "afterMatch", group: "B" },
    ],
    locks: [{ cells: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 9, y: 5 }, { x: 10, y: 5 }], hits: 2 }],
    shift: { afterMatch: "rowcol-random", step: 2, blockedStatic: true },
    notes: "用于 blocked / gate / lock / shift 的压力验证，不参与主线解锁。",
  },
];

export function getLevel(id: LevelId): LevelDef {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown level id: ${id}`);
  return l;
}

export function getNextLevelId(id: LevelId): LevelId | null {
  const current = getLevel(id);
  if (current.kind !== "main") return null;
  return MAIN_LEVELS.find((level) => level.order === current.order + 1)?.id ?? null;
}
