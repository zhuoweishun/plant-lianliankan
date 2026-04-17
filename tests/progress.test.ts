import { describe, expect, it } from "vitest";
import { defaultSave, unlockLevel, isLevelUnlocked, type SaveData } from "../src/save/save.ts";

describe("save/progress", () => {
  it("default save unlocks only L1", () => {
    const s = defaultSave();
    expect(isLevelUnlocked(s, "L1")).toBe(true);
    expect(isLevelUnlocked(s, "L2")).toBe(false);
  });

  it("unlockLevel is idempotent and unlocks new levels", () => {
    const s0 = defaultSave();
    const s1: SaveData = unlockLevel(s0, "L2");
    expect(isLevelUnlocked(s1, "L2")).toBe(true);
    const s2 = unlockLevel(s1, "L2");
    expect(s2.progress.unlockedLevelIds).toEqual(s1.progress.unlockedLevelIds);
  });
});

