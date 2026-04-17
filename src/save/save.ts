import type { InventoryJSON } from "../core/inventory/Inventory.ts";
import type { GardenGridJSON } from "../garden/GardenGrid.ts";

export const SAVE_VERSION = 1 as const;
export type SaveVersion = typeof SAVE_VERSION;

export type GardenSave = GardenGridJSON<string>;

export type SaveData = {
  version: SaveVersion;
  inventory: InventoryJSON;
  garden: GardenSave;
};

const SAVE_KEY = "plant-garden-link-match.save";

function getStorage(): Storage | null {
  // Works in browser; safe in Node (vitest/typecheck) where localStorage is absent.
  const ls = (globalThis as unknown as { localStorage?: Storage }).localStorage;
  return ls ?? null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function assertNonNegativeSafeInteger(n: number, name: string): void {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    inventory: {},
    garden: { width: 10, height: 6, placements: [] },
  };
}

export function loadSave(): SaveData {
  const storage = getStorage();
  const raw = storage?.getItem(SAVE_KEY);
  if (!raw) return defaultSave();

  try {
    const parsed: unknown = JSON.parse(raw);
    return normalizeSave(parsed);
  } catch {
    return defaultSave();
  }
}

export function writeSave(save: SaveData): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function mergeInventory(base: InventoryJSON, delta: InventoryJSON): InventoryJSON {
  const out: InventoryJSON = { ...base };
  for (const [k, v] of Object.entries(delta)) {
    if (typeof v !== "number") throw new Error(`inventory delta(${k}) must be a number`);
    assertNonNegativeSafeInteger(v, `inventory delta(${k})`);
    const prev = out[k] ?? 0;
    if (typeof prev !== "number") throw new Error(`inventory base(${k}) must be a number`);
    assertNonNegativeSafeInteger(prev, `inventory base(${k})`);
    const next = prev + v;
    assertNonNegativeSafeInteger(next, `inventory next(${k})`);
    if (next === 0) delete out[k];
    else out[k] = next;
  }
  return out;
}

export function takeFromInventory(inv: InventoryJSON, key: string, amount = 1): InventoryJSON {
  assertNonNegativeSafeInteger(amount, "amount");
  const prev = inv[key] ?? 0;
  if (typeof prev !== "number") throw new Error(`inventory(${key}) must be a number`);
  assertNonNegativeSafeInteger(prev, `inventory(${key})`);
  if (prev < amount) throw new Error(`inventory(${key}) not enough: ${prev} < ${amount}`);

  const next = prev - amount;
  const out: InventoryJSON = { ...inv };
  if (next === 0) delete out[key];
  else out[key] = next;
  return out;
}

export function addInventoryToSave(save: SaveData, delta: InventoryJSON): SaveData {
  return { ...save, inventory: mergeInventory(save.inventory, delta) };
}

export function updateGarden(save: SaveData, garden: GardenSave): SaveData {
  return { ...save, garden };
}

function normalizeSave(v: unknown): SaveData {
  if (!isPlainObject(v)) return defaultSave();
  if (v.version !== SAVE_VERSION) return defaultSave();

  const inventoryRaw = v.inventory;
  const gardenRaw = v.garden;
  if (!isPlainObject(inventoryRaw) || !isPlainObject(gardenRaw)) return defaultSave();

  const inventory: InventoryJSON = {};
  for (const [k, vv] of Object.entries(inventoryRaw)) {
    if (typeof vv !== "number") return defaultSave();
    assertNonNegativeSafeInteger(vv, `inventory(${k})`);
    if (vv !== 0) inventory[k] = vv;
  }

  const width = gardenRaw.width;
  const height = gardenRaw.height;
  const placements = gardenRaw.placements;
  if (typeof width !== "number" || typeof height !== "number" || !Array.isArray(placements)) return defaultSave();
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return defaultSave();

  const garden: GardenSave = {
    width,
    height,
    placements: placements
      .filter((p) => isPlainObject(p))
      .map((p) => ({
        id: String(p.id),
        x: Number(p.x),
        y: Number(p.y),
        w: Number(p.w),
        h: Number(p.h),
      })),
  };

  return { version: SAVE_VERSION, inventory, garden };
}

