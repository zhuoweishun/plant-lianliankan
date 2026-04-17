import type { DecorationId } from "./decorations.ts";
import type { MaterialId } from "./materials.ts";

export type Recipe = {
  decorationId: DecorationId;
  requires: Partial<Record<MaterialId, number>>;
};

export const RECIPES: readonly Recipe[] = [
  { decorationId: "bench", requires: { wood: 3 } },
  { decorationId: "pond", requires: { water: 3, stone: 2 } },
  { decorationId: "tree", requires: { leaf: 3, wood: 1 } },
] as const;

export function getRecipe(decorationId: DecorationId): Recipe {
  const r = RECIPES.find((x) => x.decorationId === decorationId);
  if (!r) throw new Error(`Unknown recipe for decoration: ${decorationId}`);
  return r;
}

