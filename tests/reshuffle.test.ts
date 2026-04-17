import { describe, expect, it } from "vitest";
import { hasAnyLinkablePair, reshuffleGrid } from "../src/core/board/reshuffle.ts";

describe("core/board/reshuffle", () => {
  it("hasAnyLinkablePair: detects a simple adjacent pair", () => {
    const grid = [
      ["a", "a"],
      ["b", "c"],
    ] as Array<Array<string | null>>;
    expect(hasAnyLinkablePair(grid)).toBe(true);
  });

  it("hasAnyLinkablePair: returns false when no duplicates exist", () => {
    const grid = [
      ["a", "b"],
      ["c", "d"],
    ] as Array<Array<string | null>>;
    expect(hasAnyLinkablePair(grid)).toBe(false);
  });

  it("reshuffleGrid preserves null positions and tile multiset, and yields at least one linkable pair (when possible)", () => {
    const grid = [
      ["a", null, "a"],
      ["b", "c", "b"],
    ] as Array<Array<string | null>>;

    const out = reshuffleGrid(grid, { seed: "t", maxTries: 50 });
    expect(out).not.toBeNull();
    if (!out) return;

    // null positions preserved
    expect(out[0]![1]).toBeNull();

    // multiset preserved
    const count = (g: Array<Array<string | null>>) => {
      const m = new Map<string, number>();
      for (const row of g) for (const v of row) {
        if (v === null) continue;
        m.set(v, (m.get(v) ?? 0) + 1);
      }
      return m;
    };
    expect(count(out)).toEqual(count(grid));

    expect(hasAnyLinkablePair(out)).toBe(true);
  });
});

