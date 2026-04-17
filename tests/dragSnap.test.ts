import { describe, expect, it } from "vitest";
import { clampTopLeftToGrid, topLeftFromHover } from "../src/ui/scenes/dragSnap.ts";

describe("ui/dragSnap", () => {
  it("keeps grab offset when snapping top-left", () => {
    expect(topLeftFromHover({ x: 5, y: 2 }, { x: 1, y: 0 })).toEqual({ x: 4, y: 2 });
    expect(topLeftFromHover({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(topLeftFromHover({ x: 3, y: 3 }, { x: 1, y: 1 })).toEqual({ x: 2, y: 3 - 1 });
  });

  it("clamps top-left so preview never expands the grid", () => {
    // 10x6 grid, 2x1 object
    expect(clampTopLeftToGrid({ x: -1, y: 0 }, { w: 2, h: 1 }, { w: 10, h: 6 })).toEqual({ x: 0, y: 0 });
    expect(clampTopLeftToGrid({ x: 9, y: 0 }, { w: 2, h: 1 }, { w: 10, h: 6 })).toEqual({ x: 8, y: 0 });
    expect(clampTopLeftToGrid({ x: 0, y: 10 }, { w: 1, h: 2 }, { w: 10, h: 6 })).toEqual({ x: 0, y: 4 });
  });
});
