import { describe, expect, it } from "vitest";
import { MATERIALS } from "../src/data/materials.ts";
import { RECIPES } from "../src/data/recipes.ts";
import { canCraftOne, craftOne } from "../src/core/crafting/crafting.ts";

describe("data/materials & data/recipes", () => {
  it("has 4 base materials and 3 recipes", () => {
    expect(MATERIALS.length).toBe(4);
    expect(RECIPES.length).toBe(3);
  });
});

describe("core/crafting", () => {
  it("canCraftOne: false when lacking materials", () => {
    expect(canCraftOne({ wood: 2 }, "bench")).toBe(false);
  });

  it("craftOne: consumes materials and produces decoration +1", () => {
    const out = craftOne({ wood: 3 }, {}, "bench");
    expect(out.materials.wood).toBeUndefined(); // consumed to 0
    expect(out.decorations.bench).toBe(1);
  });
});
