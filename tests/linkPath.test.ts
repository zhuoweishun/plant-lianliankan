import { describe, expect, it } from "vitest";
import { canLink } from "../src/core/board/linkPath.ts";

describe("core/board/linkPath.canLink", () => {
  it("直线可连：同一行中间为空", () => {
    const grid = [
      [null, null, null],
      [1, null, 2],
      [null, null, null],
    ] as const;

    expect(canLink(grid, { x: 0, y: 1 }, { x: 2, y: 1 })).toBe(true);
  });

  it("被阻挡不可连：同一行中间有阻挡", () => {
    const grid = [
      // a/b 被墙包围，无法走到任何空格，因此即使允许走廊也不可连
      [null, 9, 9, 9, null],
      [9, 1, 9, 2, 9],
      [null, 9, 9, 9, null],
    ] as const;

    expect(canLink(grid, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(false);
  });

  it("1拐可连：L 形路径", () => {
    const grid = [
      [1, null, null],
      [null, null, null],
      [null, null, 2],
    ] as const;

    // (0,0) -> (0,2) -> (2,2)
    expect(canLink(grid, { x: 0, y: 0 }, { x: 2, y: 2 })).toBe(true);
  });

  it("2拐可连：走棋盘外走廊绕过整列阻挡", () => {
    // 中间整列( x=2 )是墙，棋盘内无法跨越；需要从顶部走廊出去再回来。
    const grid = [
      [null, null, 9, null, null],
      [null, 1, 9, 2, null],
      [null, null, 9, null, null],
    ] as const;

    // 典型走廊路径（2拐）：
    // (1,1) 上 -> 出棋盘(走廊) -> 横向到列3 -> 下 -> (3,1)
    expect(canLink(grid, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(true);
  });
});
