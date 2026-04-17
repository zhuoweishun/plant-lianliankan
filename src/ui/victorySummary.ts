import type { InventoryJSON } from "../core/inventory/Inventory.ts";
import { getMaterialName, type MaterialId } from "../data/materials.ts";

export type MaterialDeltaRow = { id: MaterialId; name: string; amount: number };

const ORDER: readonly MaterialId[] = ["wood", "stone", "water", "leaf"];

export function formatMaterialDelta(inv: InventoryJSON): MaterialDeltaRow[] {
  const out: MaterialDeltaRow[] = [];
  for (const id of ORDER) {
    const amount = inv[id] ?? 0;
    if (amount > 0) out.push({ id, name: getMaterialName(id), amount });
  }
  return out;
}

