import { describe, expect, it } from "vitest";
import { GardenGrid } from "../src/garden/GardenGrid.ts";

describe("garden/GardenGrid", () => {
  it("canPlace/place: 可占格放置，且会阻止重叠", () => {
    const g = new GardenGrid({ width: 5, height: 4 });
    expect(g.canPlace(0, 0, 2, 1)).toBe(true);

    g.place("bench", 0, 0, 2, 1);
    expect(g.canPlace(0, 0, 1, 1)).toBe(false);
    expect(g.canPlace(1, 0, 2, 1)).toBe(false);
    expect(g.canPlace(2, 0, 2, 1)).toBe(true);
  });

  it("canPlace: 越界会返回 false", () => {
    const g = new GardenGrid({ width: 5, height: 4 });
    expect(g.canPlace(-1, 0, 1, 1)).toBe(false);
    expect(g.canPlace(0, -1, 1, 1)).toBe(false);
    expect(g.canPlace(4, 3, 2, 1)).toBe(false);
    expect(g.canPlace(4, 3, 1, 2)).toBe(false);
  });

  it("place: 非法放置会抛错", () => {
    const g = new GardenGrid({ width: 5, height: 4 });
    g.place("pond", 1, 1, 2, 2);
    expect(() => g.place("tree", 2, 2, 1, 1)).toThrow(); // overlap
    expect(() => g.place("tree", 4, 3, 2, 1)).toThrow(); // out of bounds
  });

  it("toJSON/fromJSON: 可往返序列化，并会校验非法数据", () => {
    const g = new GardenGrid({ width: 5, height: 4 });
    g.place("bench", 0, 0, 2, 1);
    g.place("pond", 2, 1, 2, 2);
    const json = g.toJSON();

    const g2 = GardenGrid.fromJSON(json);
    expect(g2.toJSON()).toEqual(json);

    expect(() => new GardenGrid({ width: 5, height: 4 }, [
      { id: "a", x: 0, y: 0, w: 2, h: 1 },
      { id: "b", x: 1, y: 0, w: 2, h: 1 },
    ])).toThrow();
  });

  it("findPlacementIndexAt/remove: 可按坐标找到并移除，释放占格", () => {
    const g = new GardenGrid({ width: 5, height: 4 });
    g.place("bench", 0, 0, 2, 1);

    const idx = g.findPlacementIndexAt(1, 0);
    expect(idx).toBe(0);

    const removed = g.remove(idx!);
    expect(removed.id).toBe("bench");
    expect(g.listPlacements().length).toBe(0);
    expect(g.canPlace(0, 0, 1, 1)).toBe(true);
  });

  it("move: 可移动已摆放物体（不允许重叠/越界），成功后占格会更新", () => {
    const g = new GardenGrid({ width: 5, height: 4 });
    g.place("bench", 0, 0, 2, 1);
    g.place("pond", 2, 1, 2, 2); // occupies (2-3, 1-2)

    expect(g.canMove(1, 3, 1)).toBe(true);
    expect(g.canMove(1, 1, 0)).toBe(false);

    // move pond onto bench (overlap) => false and unchanged
    expect(g.move(1, 1, 0)).toBe(false);
    const pond0 = g.listPlacements()[1]!;
    expect({ x: pond0.x, y: pond0.y }).toEqual({ x: 2, y: 1 });

    // move pond to a free spot => true and occupies there
    expect(g.move(1, 3, 1)).toBe(true); // now occupies (3-4,1-2)
    const pond1 = g.listPlacements()[1]!;
    expect({ x: pond1.x, y: pond1.y }).toEqual({ x: 3, y: 1 });
    expect(g.canPlace(2, 1, 1, 1)).toBe(true); // old spot freed

    // out of bounds => false
    expect(g.move(1, 4, 3)).toBe(false);
  });
});
