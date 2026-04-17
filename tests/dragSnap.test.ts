import { describe, expect, it } from "vitest";
import { topLeftFromHover } from "../src/ui/scenes/dragSnap.ts";

describe("ui/dragSnap", () => {
  it("keeps grab offset when snapping top-left", () => {
    expect(topLeftFromHover({ x: 5, y: 2 }, { x: 1, y: 0 })).toEqual({ x: 4, y: 2 });
    expect(topLeftFromHover({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(topLeftFromHover({ x: 3, y: 3 }, { x: 1, y: 1 })).toEqual({ x: 2, y: 3 - 1 });
  });
});

