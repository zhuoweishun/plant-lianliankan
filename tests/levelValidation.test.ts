import { describe, expect, it } from "vitest";
import { LEVELS, getLevel } from "../src/data/levels.ts";
import { validateLevel, validateLevels } from "../src/data/levelValidation.ts";

describe("data/levelValidation", () => {
  it("validateLevel: 全部关卡都能通过校验", () => {
    for (const level of LEVELS) {
      const result = validateLevel(level);
      expect(result.ok, `${level.id}: ${result.errors.join(" | ")}`).toBe(true);
      expect(result.errors).toEqual([]);
    }
  });

  it("validateLevels: 不会为现有关卡列表返回失败项", () => {
    expect(validateLevels(LEVELS).filter((result) => !result.ok)).toEqual([]);
  });

  it("会校验章节机制的渐进挂载规则", () => {
    const chapter1MechanicResult = validateLevel({
      ...getLevel("L1"),
      blocked: [{ x: 1, y: 1 }],
    });
    expect(chapter1MechanicResult.ok).toBe(false);
    expect(chapter1MechanicResult.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("L1-L10 只能是基础递进关卡")]),
    );

    const chapter3MechanicResult = validateLevel({
      ...getLevel("L21"),
      gates: undefined,
    });
    expect(chapter3MechanicResult.ok).toBe(false);
    expect(chapter3MechanicResult.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("L21-L30 必须同时具备 blocked 和 gates")]),
    );

    const chapter5ShiftResult = validateLevel({
      ...getLevel("L41"),
      shift: undefined,
    });
    expect(chapter5ShiftResult.ok).toBe(false);
    expect(chapter5ShiftResult.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("L41-L50 必须具备 blocked/gates/locks/shift")]),
    );
  });

  it("会识别机制坐标冲突、越界与容量超限", () => {
    const result = validateLevel({
      ...getLevel("L31"),
      size: { width: 4, height: 4 },
      goals: { wood: 20 },
      blocked: [{ x: 0, y: 0 }, { x: 8, y: 8 }],
      gates: [{ cells: [{ x: 0, y: 0 }], initial: "open", toggle: "afterMatch" }],
      locks: [{ cells: [{ x: 0, y: 0 }], hits: 2 }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("blocked 越界"),
        expect.stringContaining("gate 与 blocked 冲突"),
        expect.stringContaining("lock 与 blocked 冲突"),
        expect.stringContaining("目标总数不能超过棋盘容量上限"),
      ]),
    );
  });

  it("会校验 shift 与 notes 的基础合法性", () => {
    const result = validateLevel({
      ...getLevel("L50"),
      shift: { afterMatch: "row-random", step: 3 as 1, blockedStatic: false as true },
      notes: "",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("shift.step"),
        expect.stringContaining("shift.blockedStatic"),
        expect.stringContaining("notes"),
      ]),
    );
  });
});
