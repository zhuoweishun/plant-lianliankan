import { describe, expect, it } from "vitest";
import { gridCellFromClient } from "../src/ui/scenes/gridHitTest.ts";

describe("ui/gridHitTest", () => {
  it("maps client coords to grid cell (with padding+gap)", () => {
    const metrics = { padding: 10, cell: 44, gap: 2, width: 10, height: 6 };
    const rect = { left: 100, top: 50 };

    // inside cell (0,0)
    expect(gridCellFromClient({ clientX: 111, clientY: 61 }, rect, metrics)).toEqual({ x: 0, y: 0 });

    // near center of cell (1,0): offset x = padding + 1*(cell+gap) + cell/2
    const x10 = rect.left + metrics.padding + (metrics.cell + metrics.gap) * 1 + 22;
    const y00 = rect.top + metrics.padding + 22;
    expect(gridCellFromClient({ clientX: x10, clientY: y00 }, rect, metrics)).toEqual({ x: 1, y: 0 });

    // outside (before padding)
    expect(gridCellFromClient({ clientX: 105, clientY: 55 }, rect, metrics)).toBeNull();
  });

  it("returns null when outside bounds", () => {
    const metrics = { padding: 10, cell: 44, gap: 2, width: 2, height: 2 };
    const rect = { left: 0, top: 0 };
    // far right
    expect(gridCellFromClient({ clientX: 500, clientY: 20 }, rect, metrics)).toBeNull();
    // far bottom
    expect(gridCellFromClient({ clientX: 20, clientY: 500 }, rect, metrics)).toBeNull();
  });
});

