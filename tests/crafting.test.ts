import { describe, expect, it } from "vitest";
import { MATERIALS } from "../src/data/materials.ts";
import { RECIPES } from "../src/data/recipes.ts";

describe("data/materials & data/recipes", () => {
  it("has 4 base materials and 3 recipes", () => {
    expect(MATERIALS.length).toBe(4);
    expect(RECIPES.length).toBe(3);
  });
});

