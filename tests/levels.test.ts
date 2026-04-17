import { describe, expect, it } from "vitest";
import { getNextLevelId } from "../src/data/levels.ts";

describe("data/levels", () => {
  it("getNextLevelId: returns next level in order", () => {
    expect(getNextLevelId("L1")).toBe("L2");
    expect(getNextLevelId("L2")).toBe("L3");
    expect(getNextLevelId("L3")).toBeNull();
    expect(getNextLevelId("T1")).toBeNull();
  });
});
