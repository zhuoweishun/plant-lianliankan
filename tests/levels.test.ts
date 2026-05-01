import { describe, expect, it } from "vitest";
import { LEVELS, getLevel, getNextLevelId } from "../src/data/levels.ts";

describe("data/levels", () => {
  it("定义了 L1..L50 主线关卡，并保留 T1 测试关", () => {
    expect(LEVELS).toHaveLength(51);
    expect(LEVELS[0]?.id).toBe("L1");
    expect(LEVELS[49]?.id).toBe("L50");
    expect(LEVELS[50]?.id).toBe("T1");
  });

  it("L1-L10 仅保留基础递进，不挂载机制字段", () => {
    const l1 = getLevel("L1");
    expect(l1.chapter).toBe(1);
    expect(l1.blocked).toBeUndefined();
    expect(l1.gates).toBeUndefined();
    expect(l1.locks).toBeUndefined();
    expect(l1.shift).toBeUndefined();
    expect(l1.notes).toBeUndefined();

    const l10 = getLevel("L10");
    expect(l10.chapter).toBe(1);
    expect(l10.blocked).toBeUndefined();
    expect(l10.gates).toBeUndefined();
    expect(l10.locks).toBeUndefined();
    expect(l10.shift).toBeUndefined();
  });

  it("L11/L21/L31/L41 分别引入 blocked/gate/lock/shift", () => {
    const l11 = getLevel("L11");
    expect(l11.blocked?.length).toBeGreaterThan(0);
    expect(l11.gates).toBeUndefined();
    expect(l11.locks).toBeUndefined();
    expect(l11.shift).toBeUndefined();

    const l21 = getLevel("L21");
    expect(l21.blocked?.length).toBeGreaterThan(0);
    expect(l21.gates?.length).toBeGreaterThan(0);
    expect(l21.locks).toBeUndefined();
    expect(l21.shift).toBeUndefined();

    const l31 = getLevel("L31");
    expect(l31.blocked?.length).toBeGreaterThan(0);
    expect(l31.gates?.length).toBeGreaterThan(0);
    expect(l31.locks?.length).toBeGreaterThan(0);
    expect(l31.shift).toBeUndefined();

    const l41 = getLevel("L41");
    expect(l41.blocked?.length).toBeGreaterThan(0);
    expect(l41.gates?.length).toBeGreaterThan(0);
    expect(l41.locks?.length).toBeGreaterThan(0);
    expect(l41.shift).toEqual({ afterMatch: "row-random", step: 1, blockedStatic: true });
  });

  it("L50 仍处于第五章终局配置", () => {
    const l50 = getLevel("L50");
    expect(l50.chapter).toBe(5);
    expect(l50.difficulty).toBe(5);
    expect(l50.blocked?.length).toBeGreaterThan(0);
    expect(l50.gates?.length).toBeGreaterThan(0);
    expect(l50.locks?.length).toBeGreaterThan(0);
    expect(l50.shift).toEqual({ afterMatch: "rowcol-random", step: 2, blockedStatic: true });
  });

  it("getNextLevelId: 返回主线下一关，L50 与 T1 没有后续关卡", () => {
    expect(getNextLevelId("L1")).toBe("L2");
    expect(getNextLevelId("L2")).toBe("L3");
    expect(getNextLevelId("L49")).toBe("L50");
    expect(getNextLevelId("L50")).toBeNull();
    expect(getNextLevelId("T1")).toBeNull();
  });
});
