import type { MaterialId } from "./materials.ts";

export type LevelId = "L1" | "L2" | "L3" | "T1";

export type LevelDef = {
  id: LevelId;
  name: string;
  size: { width: number; height: number };
  /**
   * Tile ids for match board generation.
   */
  materialIds: readonly MaterialId[];
  /**
   * Collection goals, measured in "drops" (one match => dropForMatch => +1).
   */
  goals: Partial<Record<MaterialId, number>>;
};

export const LEVELS: readonly LevelDef[] = [
  {
    id: "L1",
    name: "第 1 关：收集材料",
    size: { width: 10, height: 8 },
    materialIds: ["wood", "stone", "water", "leaf"],
    goals: { wood: 10 },
  },
  {
    id: "L2",
    name: "第 2 关：收集材料",
    size: { width: 10, height: 8 },
    materialIds: ["wood", "stone", "water", "leaf"],
    goals: { water: 10, stone: 6 },
  },
  {
    id: "L3",
    name: "第 3 关：收集材料",
    size: { width: 12, height: 8 },
    materialIds: ["wood", "stone", "water", "leaf"],
    goals: { leaf: 12, wood: 6 },
  },
  {
    id: "T1",
    name: "测试关：无解压力",
    size: { width: 14, height: 10 },
    materialIds: ["wood", "stone", "water", "leaf"],
    goals: { wood: 60, water: 50, leaf: 50, stone: 40 },
  },
] as const satisfies readonly LevelDef[];

export function getLevel(id: LevelId): LevelDef {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown level id: ${id}`);
  return l;
}

export function getNextLevelId(id: LevelId): LevelId | null {
  // Only mainline levels participate in "next level" progression.
  if (id === "T1") return null;
  const mainline: LevelId[] = ["L1", "L2", "L3"];
  const idx = mainline.indexOf(id);
  if (idx < 0) return null;
  const next = mainline[idx + 1];
  return next ?? null;
}
