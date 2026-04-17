import { describe, expect, it } from "vitest";
import { canLink } from "../src/core/board/linkPath.ts";
import { findAnyLinkablePair } from "../src/core/board/hint.ts";

describe("core/board/hint", () => {
  it("returns a linkable pair when available", () => {
    const grid = [
      ["a", "a"],
      ["b", "c"],
    ] as Array<Array<string | null>>;

    const pair = findAnyLinkablePair(grid);
    expect(pair).not.toBeNull();
    if (!pair) return;
    const { a, b } = pair;
    expect(grid[a.y]![a.x]).toBe(grid[b.y]![b.x]);
    expect(canLink(grid, a, b)).toBe(true);
  });

  it("returns null when no pair exists", () => {
    const grid = [
      ["a", "b"],
      ["c", "d"],
    ] as Array<Array<string | null>>;
    expect(findAnyLinkablePair(grid)).toBeNull();
  });
});

