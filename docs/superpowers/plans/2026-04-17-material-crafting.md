# Material Crafting (材料掉落→合成装饰) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将对局掉落从“装饰”改为“材料”，并在花园侧边栏提供“工作台合成”把材料合成装饰，解决装饰泛滥问题；同时提供 v1→v2 存档迁移。

**Architecture:**  
核心原则是“数据定义集中 + 纯函数优先 + UI 只做薄封装”。新增 `materials.ts` 和 `recipes.ts` 作为单一事实来源；新增 `crafting.ts` 作为纯函数合成引擎；`save.ts` 负责版本迁移；`GardenScene` 只负责渲染与点击回调。  

**Tech Stack:** TypeScript + Vite + Vitest；localStorage SaveData；Canvas(board) + DOM(HUD)。

---

## File map (新增/修改清单)

**Create**
- `src/data/materials.ts` — 材料定义与展示名
- `src/data/recipes.ts` — 合成配方（装饰 → 材料需求）
- `src/core/crafting/crafting.ts` — 纯函数：能否合成 / 扣材料 / 加装饰
- `tests/crafting.test.ts` — 合成逻辑单测
- `tests/saveMigrationV2.test.ts` — v1→v2 迁移单测

**Modify**
- `src/save/save.ts` — bump SAVE_VERSION=2，新增 materials 字段，写迁移
- `src/data/levels.ts` — goals 类型从 DecorationId 改为 MaterialId（或新增字段并迁移）
- `src/ui/scenes/MatchScene.ts` — board tile 类型从 DecorationId 改为 MaterialId；掉落到 sessionInventory(材料)
- `src/ui/scenes/GardenScene.ts` — 新增工作台 UI：材料库存 + 合成按钮；背包装饰列表仅显示装饰库存
- `src/app/App.ts` — 结算写入 save.materials（胜利才结算），并保持关卡解锁逻辑
- `src/core/level/goals.ts` — 适配材料 goals
- `src/core/drops/dropTable.ts` — 变更为材料掉落（或直接移除并内联）

---

## Task 1: 新增材料与配方数据

**Files:**
- Create: `src/data/materials.ts`
- Create: `src/data/recipes.ts`
- Test: `tests/crafting.test.ts`（先占位写一条 failing test，确保后续文件引用存在）

- [ ] Step 1: 写 failing test（引用 recipes/materials）

```ts
import { describe, expect, it } from "vitest";
import { MATERIALS } from "../src/data/materials.ts";
import { RECIPES } from "../src/data/recipes.ts";

describe("data/materials & data/recipes", () => {
  it("has 4 base materials and 3 recipes", () => {
    expect(MATERIALS.length).toBe(4);
    expect(RECIPES.length).toBe(3);
  });
});
```

- [ ] Step 2: Run test (expect FAIL: modules missing)

Run: `npm test -- tests/crafting.test.ts`  
Expected: FAIL with “Cannot find module …”

- [ ] Step 3: 实现 `materials.ts`

```ts
export type MaterialId = "wood" | "stone" | "water" | "leaf";

export type MaterialDef = { id: MaterialId; name: string };

export const MATERIALS: readonly MaterialDef[] = [
  { id: "wood", name: "木材" },
  { id: "stone", name: "石头" },
  { id: "water", name: "水" },
  { id: "leaf", name: "叶子" },
] as const;

export function isMaterialId(x: string): x is MaterialId {
  return x === "wood" || x === "stone" || x === "water" || x === "leaf";
}
```

- [ ] Step 4: 实现 `recipes.ts`

```ts
import type { DecorationId } from "./decorations.ts";
import type { MaterialId } from "./materials.ts";

export type Recipe = {
  decorationId: DecorationId;
  requires: Partial<Record<MaterialId, number>>;
};

export const RECIPES: readonly Recipe[] = [
  { decorationId: "bench", requires: { wood: 3 } },
  { decorationId: "pond", requires: { water: 3, stone: 2 } },
  { decorationId: "tree", requires: { leaf: 3, wood: 1 } },
] as const;

export function getRecipe(decorationId: DecorationId): Recipe {
  const r = RECIPES.find((x) => x.decorationId === decorationId);
  if (!r) throw new Error(`Unknown recipe for decoration: ${decorationId}`);
  return r;
}
```

- [ ] Step 5: Run test (expect PASS)

Run: `npm test -- tests/crafting.test.ts`  
Expected: PASS

- [ ] Step 6: Commit

```bash
git add src/data/materials.ts src/data/recipes.ts tests/crafting.test.ts
git commit -m "feat(data): add materials and crafting recipes"
```

---

## Task 2: 合成纯函数（crafting engine）

**Files:**
- Create: `src/core/crafting/crafting.ts`
- Modify: `tests/crafting.test.ts`

- [ ] Step 1: 扩展 failing tests（合成成功/失败）

```ts
import { describe, expect, it } from "vitest";
import { craftOne, canCraftOne } from "../src/core/crafting/crafting.ts";

describe("core/crafting", () => {
  it("canCraftOne: false when lacking materials", () => {
    expect(canCraftOne({ wood: 2 }, "bench")).toBe(false);
  });

  it("craftOne: consumes materials and produces decoration +1", () => {
    const out = craftOne({ wood: 3 }, {}, "bench");
    expect(out.materials.wood).toBeUndefined(); // consumed to 0
    expect(out.decorations.bench).toBe(1);
  });
});
```

- [ ] Step 2: Run test (expect FAIL: module missing)

Run: `npm test -- tests/crafting.test.ts`  
Expected: FAIL with missing module `src/core/crafting/crafting.ts`

- [ ] Step 3: 实现 `crafting.ts`（纯函数）

```ts
import type { InventoryJSON } from "../inventory/Inventory.ts";
import type { DecorationId } from "../../data/decorations.ts";
import type { MaterialId } from "../../data/materials.ts";
import { getRecipe } from "../../data/recipes.ts";
import { mergeInventory, takeFromInventory } from "../../save/save.ts";

export function canCraftOne(materials: InventoryJSON, decorationId: DecorationId): boolean {
  const recipe = getRecipe(decorationId);
  for (const [k, v] of Object.entries(recipe.requires)) {
    const need = (v ?? 0) as number;
    if (need <= 0) continue;
    const have = materials[k] ?? 0;
    if (have < need) return false;
  }
  return true;
}

export function craftOne(
  materials: InventoryJSON,
  decorations: InventoryJSON,
  decorationId: DecorationId,
): { materials: InventoryJSON; decorations: InventoryJSON } {
  if (!canCraftOne(materials, decorationId)) throw new Error("not enough materials");
  const recipe = getRecipe(decorationId);

  let nextMaterials: InventoryJSON = { ...materials };
  for (const [k, v] of Object.entries(recipe.requires)) {
    const need = (v ?? 0) as number;
    if (need <= 0) continue;
    nextMaterials = takeFromInventory(nextMaterials, k, need);
  }

  const nextDecorations = mergeInventory(decorations, { [decorationId]: 1 });
  return { materials: nextMaterials, decorations: nextDecorations };
}
```

- [ ] Step 4: Run tests (expect PASS)

Run: `npm test -- tests/crafting.test.ts`  
Expected: PASS

- [ ] Step 5: Commit

```bash
git add src/core/crafting/crafting.ts tests/crafting.test.ts
git commit -m "feat(crafting): add pure crafting engine"
```

---

## Task 3: 存档 v2 + 迁移（bench/pond/tree → wood/water/leaf）

**Files:**
- Modify: `src/save/save.ts`
- Create: `tests/saveMigrationV2.test.ts`

- [ ] Step 1: 写 failing migration test（模拟 v1 save）

```ts
import { describe, expect, it } from "vitest";
import { loadSave, writeSave } from "../src/save/save.ts";

describe("save migration v1->v2", () => {
  it("migrates decoration inventory to materials and keeps placements", () => {
    const storage = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    };

    storage.set(
      "plant-garden-link-match.save",
      JSON.stringify({
        version: 1,
        inventory: { bench: 5, pond: 2, tree: 7 },
        garden: { width: 10, height: 6, placements: [{ id: "bench", x: 0, y: 0, w: 2, h: 1 }] },
        progress: { unlockedLevelIds: ["L1"] },
      }),
    );

    const s = loadSave();
    expect(s.version).toBe(2);
    expect(s.materials.wood).toBe(5);
    expect(s.materials.water).toBe(2);
    expect(s.materials.leaf).toBe(7);
    expect(s.inventory.bench ?? 0).toBe(0);
    expect(s.garden.placements.length).toBe(1);
  });
});
```

- [ ] Step 2: Run test (expect FAIL until SAVE_VERSION bumped and migration exists)

Run: `npm test -- tests/saveMigrationV2.test.ts`  
Expected: FAIL (likely version mismatch defaulting)

- [ ] Step 3: 修改 `save.ts`
Key changes:
- `SAVE_VERSION = 2`
- `SaveData` 增加 `materials: InventoryJSON`
- `defaultSave()` 初始化 `materials: {}`
- `normalizeSave()`：
  - 若 `version===2`：正常读取 inventory/materials/garden/progress
  - 若 `version===1`：读取 v1，并迁移：
    - materials += { wood: inventory.bench, water: inventory.pond, leaf: inventory.tree }
    - inventory 删除 bench/pond/tree
    - 其它 inventory key（如果未来有）保留
    - garden/progress 保留

- [ ] Step 4: Run test (expect PASS)

Run: `npm test -- tests/saveMigrationV2.test.ts`  
Expected: PASS

- [ ] Step 5: Run full tests

Run: `npm test && npm run typecheck`  
Expected: PASS

- [ ] Step 6: Commit

```bash
git add src/save/save.ts tests/saveMigrationV2.test.ts
git commit -m "feat(save): v2 add materials inventory and migrate from v1"
```

---

## Task 4: 关卡目标与对局 tile 切换到材料

**Files:**
- Modify: `src/data/levels.ts`
- Modify: `src/core/level/goals.ts`
- Modify: `src/ui/scenes/MatchScene.ts`
- Modify: `tests/levelGoals.test.ts`（若需要）

- [ ] Step 1: 调整 LevelDef.goals 类型为 MaterialId
将 levels 的 goals 从 bench/pond/tree 改为 wood/stone/water/leaf（先做简单映射）：
- L1: wood 6
- L2: water 6 + stone 2
- L3: leaf 6 + wood 2
- T1: wood 30 + water 20 + leaf 20 + stone 10（总和不超过容量限制逻辑需要同步调整：boardGen 的 requiredPairs 语义要改成“至少出现对子数”，但此处可以先不对齐，由后续 genBoard 选材池解决；或临时不使用 requiredPairs 对材料目标）

- [ ] Step 2: MatchScene 的 MaterialId 改为 `MaterialId`（而非 DecorationId）
关键点：
- board 生成 materialIds 改为 `MATERIALS.map(m=>m.id)`
- 掉落 inventory 记录材料
- goals UI 读取材料展示名（用 materials.ts）

- [ ] Step 3: Run tests

Run: `npm test && npm run typecheck`

- [ ] Step 4: Commit

```bash
git add src/data/levels.ts src/core/level/goals.ts src/ui/scenes/MatchScene.ts tests/levelGoals.test.ts
git commit -m "feat(level): switch match tiles and goals to materials"
```

---

## Task 5: 结算写入 materials（胜利才结算）

**Files:**
- Modify: `src/app/App.ts`

- [ ] Step 1: 更新结算逻辑
`awardAndUnlock()` 改为：
- 胜利：`save.materials = mergeInventory(save.materials, sessionInventory)`
- 解锁逻辑不变

- [ ] Step 2: Run tests

Run: `npm test && npm run typecheck`

- [ ] Step 3: Commit

```bash
git add src/app/App.ts
git commit -m "feat(match): award materials on win and unlock next level"
```

---

## Task 6: 花园工作台 UI + 合成按钮

**Files:**
- Modify: `src/ui/scenes/GardenScene.ts`

- [ ] Step 1: UI 渲染材料库存区（save.materials）
- [ ] Step 2: UI 渲染配方列表（RECIPES），展示材料需求与“合成”按钮
- [ ] Step 3: 点击合成：
  - 调用 `craftOne(save.materials, save.inventory, decorationId)`
  - 写入 save 并 re-render
- [ ] Step 4: 背包装饰列表只展示装饰库存（bench/pond/tree）
（材料不再出现在“背包装饰”里）

- [ ] Step 5: Run tests + manual smoke

Run: `npm test && npm run typecheck`  
Manual: 进花园看材料区、合成按钮是否启用/禁用合理

- [ ] Step 6: Commit

```bash
git add src/ui/scenes/GardenScene.ts
git commit -m "feat(garden): add crafting bench UI and separate materials/decorations"
```

---

## Task 7: 预览验收清单

- [ ] Step 1: 在 SOLO 预览里打 L1 一局，胜利回花园后：材料增加、装饰不直接增加
- [ ] Step 2: 在花园用材料合成长椅：材料减少、装饰库存 +1
- [ ] Step 3: 放置长椅：装饰库存 -1，花园摆放出现
- [ ] Step 4: 旧存档迁移：若原本有大量 bench/pond/tree，重载后应转成 materials

---

## Self-review (plan)
- 覆盖 spec 1-9：材料定义、配方、SaveData materials、迁移、对局掉落、花园合成、验收均有对应 Task。  
- 无 TBD/TODO；每个 Task 都给出了具体文件路径与命令。  
- 边界清晰：recipes/materials 为数据源，crafting 为纯函数，save 为迁移，UI 只负责渲染与事件。

