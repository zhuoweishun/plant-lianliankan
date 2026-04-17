import { describe, expect, it } from "vitest";
import { canLink, findLinkPath } from "../src/core/board/linkPath.ts";

describe("core/board/linkPath.findLinkPath", () => {
  it("returns a straight path when directly linkable", () => {
    const grid = [
      ["a", null, "a"],
      [null, null, null],
    ] as Array<Array<string | null>>;

    const a = { x: 0, y: 0 };
    const b = { x: 2, y: 0 };
    expect(canLink(grid, a, b)).toBe(true);

    const path = findLinkPath(grid, a, b);
    expect(path).not.toBeNull();
    if (!path) return;
    expect(path[0]).toEqual(a);
    expect(path[path.length - 1]).toEqual(b);
  });

  it("returns null when not linkable", () => {
    const grid = [
      ["a", "x", "a"],
      ["x", "x", "x"],
    ] as Array<Array<string | null>>;
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 }; // same cell is never linkable
    expect(canLink(grid, a, b)).toBe(false);
    expect(findLinkPath(grid, a, b)).toBeNull();
  });
});
