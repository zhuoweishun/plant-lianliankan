import { describe, expect, it } from "vitest";
import { Inventory } from "../src/core/inventory/Inventory.ts";
import { dropForMatch } from "../src/core/drops/dropTable.ts";

describe("core/inventory/Inventory", () => {
  it("add/get: 缺省为 0，add 后计数累加", () => {
    const inv = new Inventory<string>();
    expect(inv.get("rose")).toBe(0);

    expect(inv.add("rose")).toBe(1);
    expect(inv.get("rose")).toBe(1);

    expect(inv.add("rose", 2)).toBe(3);
    expect(inv.get("rose")).toBe(3);
    expect(inv.get("tulip")).toBe(0);
  });

  it("toJSON/fromJSON: 可往返序列化", () => {
    const inv = new Inventory<string>();
    inv.add("rose", 3);
    inv.add("tulip", 1);

    const json = inv.toJSON();
    expect(json).toEqual({ rose: 3, tulip: 1 });

    const inv2 = Inventory.fromJSON<string>(json);
    expect(inv2.get("rose")).toBe(3);
    expect(inv2.get("tulip")).toBe(1);
    expect(inv2.get("lily")).toBe(0);
  });

  it("fromJSON: 会拒绝非法数据", () => {
    expect(() => Inventory.fromJSON({ rose: -1 })).toThrow();
    expect(() => Inventory.fromJSON({ rose: 1.5 })).toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => Inventory.fromJSON({ rose: "1" as any })).toThrow();
  });
});

describe("core/drops/dropTable.dropForMatch", () => {
  it("MVP：掉落同名素材 1", () => {
    expect(dropForMatch("rose")).toEqual([{ materialId: "rose", amount: 1 }]);
  });
});

