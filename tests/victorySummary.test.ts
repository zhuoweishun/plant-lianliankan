import { describe, expect, it } from "vitest";
import { formatMaterialDelta } from "../src/ui/victorySummary.ts";

describe("ui/victorySummary", () => {
  it("filters <=0 and orders by wood/stone/water/leaf", () => {
    const rows = formatMaterialDelta({ leaf: 2, wood: 5, stone: 0, water: 1 });
    expect(rows).toEqual([
      { id: "wood", name: "木材", amount: 5 },
      { id: "water", name: "水", amount: 1 },
      { id: "leaf", name: "叶子", amount: 2 },
    ]);
  });
});

