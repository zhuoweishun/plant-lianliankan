import type { InventoryJSON } from "../inventory/Inventory.ts";

export type Goals<TMaterialId extends string = string> = Partial<Record<TMaterialId, number>>;

export function isGoalsCompleted<TMaterialId extends string = string>(
  goals: Goals<TMaterialId>,
  inventory: InventoryJSON,
): boolean {
  for (const id of Object.keys(goals)) {
    const need = (goals as Record<string, number | undefined>)[id] ?? 0;
    if (need <= 0) continue;
    const have = inventory[id] ?? 0;
    if (have < need) return false;
  }
  return true;
}
