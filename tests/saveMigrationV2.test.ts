import { afterEach, describe, expect, it } from "vitest";
import { loadSave } from "../src/save/save.ts";

describe("save migration v1->v2", () => {
  const storage = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  };

  afterEach(() => storage.clear());

  it("migrates decoration inventory to materials and keeps placements", () => {
    storage.set(
      "plant-garden-link-match.save",
      JSON.stringify({
        version: 1,
        inventory: { bench: 5, pond: 2, tree: 7 },
        garden: { width: 10, height: 6, placements: [{ id: "bench", x: 0, y: 0, w: 2, h: 1 }] },
        progress: { unlockedLevelIds: ["L1"] },
      }),
    );

    const s = loadSave() as any;
    expect(s.version).toBe(2);
    expect(s.materials.wood).toBe(5);
    expect(s.materials.water).toBe(2);
    expect(s.materials.leaf).toBe(7);
    expect(s.inventory.bench ?? 0).toBe(0);
    expect(s.garden.placements.length).toBe(1);
  });
});

