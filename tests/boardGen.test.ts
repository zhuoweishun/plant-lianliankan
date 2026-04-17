import { describe, expect, it } from "vitest";
import { genBoard } from "../src/core/board/boardGen.ts";

describe("core/board/boardGen.genBoard", () => {
  it("生成尺寸正确的棋盘", () => {
    const size = { width: 6, height: 4 };
    const board = genBoard(size, {
      seed: "size-check",
      materialIds: ["a", "b", "c"],
    });

    expect(board.width).toBe(size.width);
    expect(board.height).toBe(size.height);
    expect(board.grid.length).toBe(size.height);
    for (const row of board.grid) {
      expect(row.length).toBe(size.width);
    }
  });

  it("每种 materialId 的计数为偶数（成对）", () => {
    const materialIds = ["rose", "tulip", "lily"] as const;
    const board = genBoard(
      { width: 8, height: 6 },
      { seed: 12345, materialIds },
    );

    const counts = new Map<string, number>();
    for (const id of materialIds) counts.set(id, 0);

    for (const row of board.grid) {
      for (const cell of row) {
        expect(cell).not.toBeNull();
        const id = cell as string;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }

    for (const id of materialIds) {
      expect((counts.get(id) ?? 0) % 2).toBe(0);
    }
  });
});

