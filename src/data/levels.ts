import type { DecorationId } from "./decorations.ts";

export type LevelId = "L1" | "L2" | "L3";

export type LevelDef = {
  id: LevelId;
  name: string;
  size: { width: number; height: number };
  materialIds: readonly DecorationId[];
  /**
   * Collection goals, measured in "drops" (one match => dropForMatch => +1).
   */
  goals: Partial<Record<DecorationId, number>>;
};

export const LEVELS: readonly LevelDef[] = [
  {
    id: "L1",
    name: "第 1 关：收集长椅",
    size: { width: 10, height: 8 },
    materialIds: ["bench", "pond", "tree"],
    goals: { bench: 3 },
  },
  {
    id: "L2",
    name: "第 2 关：收集池塘",
    size: { width: 10, height: 8 },
    materialIds: ["bench", "pond", "tree"],
    goals: { pond: 3, bench: 1 },
  },
  {
    id: "L3",
    name: "第 3 关：收集小树",
    size: { width: 12, height: 8 },
    materialIds: ["bench", "pond", "tree"],
    goals: { tree: 4, pond: 1 },
  },
] as const satisfies readonly LevelDef[];

export function getLevel(id: LevelId): LevelDef {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown level id: ${id}`);
  return l;
}

