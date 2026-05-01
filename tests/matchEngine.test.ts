import { describe, expect, it } from "vitest";
import type { LevelDef } from "../src/data/levels.ts";
import type { MaterialId } from "../src/data/materials.ts";
import { makeEngine } from "../src/core/match/engine.ts";

function mkLevel(partial: Partial<LevelDef>): LevelDef {
  return {
    id: "T1",
    order: 0,
    kind: "test",
    chapter: 0,
    difficulty: 5,
    name: "test",
    size: { width: 6, height: 4 },
    materialIds: ["wood", "stone"] as readonly MaterialId[],
    goals: { wood: 1 },
    ...partial,
  };
}

describe("core/match/engine", () => {
  it("blocked: 不会放 tile，且会阻挡路径", () => {
    const level = mkLevel({ blocked: [{ x: 2, y: 1 }, { x: 3, y: 1 }] });
    const engine = makeEngine(level, { seed: "blocked" });
    expect(engine.getTileId(2, 1)).toBeNull();
    expect(engine.buildLinkGrid()[1]![2]).not.toBeNull();
  });

  it("gate: 每次成功消除后切换 open/closed", () => {
    const level = mkLevel({
      gates: [{ cells: [{ x: 1, y: 1 }, { x: 1, y: 2 }], initial: "closed", toggle: "afterMatch" }],
    });
    const engine = makeEngine(level, { seed: "gate" });
    expect(engine.isGateOpen(1, 1)).toBe(false);
    engine.onAfterSuccessfulMatch();
    expect(engine.isGateOpen(1, 1)).toBe(true);
    engine.onAfterSuccessfulMatch();
    expect(engine.isGateOpen(1, 1)).toBe(false);
  });

  it("lock: 第一次命中只破锁不掉落，第二次才移除掉落", () => {
    const level = mkLevel({
      locks: [{ cells: [{ x: 0, y: 0 }], hits: 2 }],
    });
    const engine = makeEngine(level, { seed: "lock" });
    engine.debugSetTile(0, 0, "wood", 2);
    engine.debugSetTile(1, 0, "wood", 0);

    const first = engine.tryMatch({ x: 0, y: 0 }, { x: 1, y: 0 });
    expect(first.matched).toBe(true);
    expect(first.removed).toBe(false);
    expect(first.drops).toEqual([]);
    expect(engine.getLockHits(0, 0)).toBe(1);
    expect(engine.getTileId(0, 0)).toBe("wood");
    expect(engine.getTileId(1, 0)).toBe("wood");

    const second = engine.tryMatch({ x: 0, y: 0 }, { x: 1, y: 0 });
    expect(second.matched).toBe(true);
    expect(second.removed).toBe(true);
    expect(second.drops).toEqual(["wood"]);
    expect(engine.getTileId(0, 0)).toBeNull();
    expect(engine.getTileId(1, 0)).toBeNull();
  });

  it("shift: 只在 normal 格中循环平移，blocked 与 gate 固定不动", () => {
    const level = mkLevel({
      size: { width: 6, height: 2 },
      blocked: [{ x: 2, y: 0 }],
      gates: [{ cells: [{ x: 4, y: 0 }], initial: "open", toggle: "afterMatch" }],
      shift: { afterMatch: "row-random", step: 1, blockedStatic: true },
    });
    const engine = makeEngine(level, { seed: "shift" });
    engine.debugSetTile(0, 0, "wood", 0);
    engine.debugSetTile(1, 0, "stone", 0);
    engine.debugSetTile(3, 0, "wood", 0);
    engine.debugSetTile(5, 0, "stone", 0);

    engine.applyShift({ axis: "row", index: 0, step: 1 });

    expect(engine.isBlocked(2, 0)).toBe(true);
    expect(engine.isGate(4, 0)).toBe(true);
    expect(engine.getTileId(2, 0)).toBeNull();
    expect(engine.getTileId(4, 0)).toBeNull();
    expect(engine.getTileId(0, 0)).toBe("stone");
    expect(engine.getTileId(1, 0)).toBe("wood");
    expect(engine.getTileId(3, 0)).toBe("stone");
    expect(engine.getTileId(5, 0)).toBe("wood");
  });

  it("findHintPair / hasAnyMove / reshuffle 可工作", () => {
    const level = mkLevel({});
    const engine = makeEngine(level, { seed: "hint" });
    engine.debugSetTile(0, 0, "wood", 0);
    engine.debugSetTile(1, 0, "wood", 0);
    engine.debugSetTile(2, 0, "stone", 0);
    engine.debugSetTile(3, 0, "stone", 0);
    expect(engine.hasAnyMove()).toBe(true);
    expect(engine.findHintPair()).not.toBeNull();
    expect(engine.reshuffle("reshuffle")).toBe(true);
  });
});
