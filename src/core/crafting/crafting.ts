import type { InventoryJSON } from "../inventory/Inventory.ts";
import type { DecorationId } from "../../data/decorations.ts";
import { getRecipe } from "../../data/recipes.ts";
import { mergeInventory, takeFromInventory } from "../../save/save.ts";

export function canCraftOne(materials: InventoryJSON, decorationId: DecorationId): boolean {
  const recipe = getRecipe(decorationId);
  for (const [id, amount] of Object.entries(recipe.requires)) {
    const need = (amount ?? 0) as number;
    if (need <= 0) continue;
    const have = materials[id] ?? 0;
    if (have < need) return false;
  }
  return true;
}

export function craftOne(
  materials: InventoryJSON,
  decorations: InventoryJSON,
  decorationId: DecorationId,
): { materials: InventoryJSON; decorations: InventoryJSON } {
  if (!canCraftOne(materials, decorationId)) {
    throw new Error("not enough materials");
  }

  const recipe = getRecipe(decorationId);

  let nextMaterials: InventoryJSON = { ...materials };
  for (const [id, amount] of Object.entries(recipe.requires)) {
    const need = (amount ?? 0) as number;
    if (need <= 0) continue;
    nextMaterials = takeFromInventory(nextMaterials, id, need);
  }

  const nextDecorations = mergeInventory(decorations, { [decorationId]: 1 });
  return { materials: nextMaterials, decorations: nextDecorations };
}

