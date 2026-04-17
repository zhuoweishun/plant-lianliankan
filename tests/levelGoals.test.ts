import { describe, expect, it } from "vitest";
import { isGoalsCompleted } from "../src/core/level/goals.ts";

describe("core/level/goals", () => {
  it("returns true when all required amounts are met", () => {
    const goals = { bench: 2, pond: 1 };
    expect(isGoalsCompleted(goals, { bench: 2, pond: 1 })).toBe(true);
    expect(isGoalsCompleted(goals, { bench: 3, pond: 1 })).toBe(true);
  });

  it("returns false when any goal is not met", () => {
    const goals = { bench: 2, pond: 1 };
    expect(isGoalsCompleted(goals, { bench: 1, pond: 1 })).toBe(false);
    expect(isGoalsCompleted(goals, { bench: 2 })).toBe(false);
  });
});

