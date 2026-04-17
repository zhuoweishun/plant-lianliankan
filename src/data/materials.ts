export type MaterialId = "wood" | "stone" | "water" | "leaf";

export type MaterialDef = { id: MaterialId; name: string };

export const MATERIALS: readonly MaterialDef[] = [
  { id: "wood", name: "木材" },
  { id: "stone", name: "石头" },
  { id: "water", name: "水" },
  { id: "leaf", name: "叶子" },
] as const;

export function isMaterialId(x: string): x is MaterialId {
  return x === "wood" || x === "stone" || x === "water" || x === "leaf";
}

export function getMaterialName(id: MaterialId): string {
  switch (id) {
    case "wood":
      return "木材";
    case "stone":
      return "石头";
    case "water":
      return "水";
    case "leaf":
      return "叶子";
  }
}

