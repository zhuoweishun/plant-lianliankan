# UI 贴纸图标接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Match 棋盘、胜利结算、花园材料/工作台/背包处接入 `public/ui/stickers/*.png` 贴纸图标，替换现有的纯色块/纯文字展示。

**Architecture:**  
1) 新增 `src/ui/stickers.ts` 统一管理贴纸 URL 与预加载缓存（Canvas 渲染依赖）。  
2) MatchScene Canvas tile 渲染改为“卡片底 + icon”。  
3) 其他 DOM 区域（胜利结算、花园侧栏）用 `<img>` + 少量 CSS inline style 接入图标。  
4) 保持 `vite.config.ts base: "./"` 可用：一律使用 `import.meta.env.BASE_URL` 拼接资源路径。

**Tech Stack:** TypeScript + Vite + Canvas 2D + DOM (innerHTML) + Vitest

---

## 0. 文件结构与改动点（先读后改）

**Create**
- `src/ui/stickers.ts`：贴纸 id → URL、预加载、缓存 Image

**Modify**
- `src/ui/scenes/MatchScene.ts`：棋盘 tile 画法 + 胜利结算明细行加 icon
- `src/ui/scenes/GardenScene.ts`：材料库存、合成配方、装饰背包按钮加 icon
- `src/ui/victorySummary.ts`（可选）：若需要在格式化输出里携带 icon id（本计划默认不改它）

**Assets (already present)**
- `public/ui/stickers/{wood,stone,water,leaf,bench,pond,tree}.png`

**Tests**
- `tests/stickers.test.ts`（新增）：路径拼接 + preload 行为（轻量）

---

## Task 1: 新增 stickers 资产模块（URL + 预加载缓存）

**Files:**
- Create: `src/ui/stickers.ts`
- Test: `tests/stickers.test.ts`

- [ ] **Step 1: 写 failing test（URL 拼接）**

创建 `tests/stickers.test.ts`：
```ts
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("Image", class FakeImage {
  public src = "";
  public onload: null | (() => void) = null;
  public onerror: null | (() => void) = null;
});

describe("stickers", () => {
  it("stickerUrl uses BASE_URL prefix", async () => {
    const mod = await import("../src/ui/stickers.ts");
    // vitest 环境下 BASE_URL 通常是 "/"
    expect(mod.stickerUrl("wood")).toMatch(/ui\\/stickers\\/wood\\.png$/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
npm test -- tests/stickers.test.ts
```
Expected: FAIL（因为 `src/ui/stickers.ts` 不存在）

- [ ] **Step 3: 实现最小 stickers.ts**

创建 `src/ui/stickers.ts`：
```ts
export type StickerId = "wood" | "stone" | "water" | "leaf" | "bench" | "pond" | "tree";

const cache = new Map<StickerId, HTMLImageElement>();

export function stickerUrl(id: StickerId): string {
  // IMPORTANT: 兼容 GH Pages base=./
  return `${import.meta.env.BASE_URL}ui/stickers/${id}.png`;
}

export function getStickerImage(id: StickerId): HTMLImageElement | undefined {
  return cache.get(id);
}

export function preloadStickers(ids: readonly StickerId[]): Promise<void> {
  const unique = Array.from(new Set(ids));
  const tasks = unique.map(
    (id) =>
      new Promise<void>((resolve) => {
        if (cache.has(id)) return resolve();
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // 不阻塞：失败就降级
        img.src = stickerUrl(id);
        cache.set(id, img);
      }),
  );
  return Promise.all(tasks).then(() => undefined);
}
```

- [ ] **Step 4: 补充测试覆盖 preload（不要求真的加载成功）**

在 `tests/stickers.test.ts` 追加：
```ts
it("preloadStickers caches images", async () => {
  const mod = await import("../src/ui/stickers.ts");
  await mod.preloadStickers(["wood", "wood", "stone"]);
  expect(mod.getStickerImage("wood")).toBeTruthy();
  expect(mod.getStickerImage("stone")).toBeTruthy();
});
```

- [ ] **Step 5: 运行测试**

Run:
```bash
npm test
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/stickers.ts tests/stickers.test.ts
git commit -m "feat(ui): add sticker assets loader"
```

---

## Task 2: MatchScene 棋盘 tile 改为“卡片底 + 贴纸图标”

**Files:**
- Modify: `src/ui/scenes/MatchScene.ts`

- [ ] **Step 1: 预加载材料贴纸**

在 `MatchScene.mount()` / `restart()` 之后确保调用：
```ts
import { preloadStickers } from "../stickers.ts";
// ...
void preloadStickers(["wood", "stone", "water", "leaf"]);
```

建议放在 `restart()` 最后或 `mount()` 完成 DOM 初始化后即可。

- [ ] **Step 2: 新增一个 drawTileIcon helper**

在 `MatchScene.ts` 内（类外）新增：
```ts
import { getStickerImage } from "../stickers.ts";

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawStickerInCell(
  ctx: CanvasRenderingContext2D,
  materialId: "wood" | "stone" | "water" | "leaf",
  left: number,
  top: number,
  size: number,
) {
  // 卡片底
  ctx.save();
  drawRoundedRect(ctx, left + 4, top + 4, size - 8, size - 8, 14);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const img = getStickerImage(materialId);
  if (!img) return;

  // icon 尺寸与留白
  const pad = 8;
  const iconSize = size - pad * 2;
  ctx.drawImage(img, left + pad, top + pad, iconSize, iconSize);
}
```

- [ ] **Step 3: 在 draw() 循环里替换原来的填色块+文字**

把：
```ts
ctx.fillStyle = colorFor(v);
ctx.fillRect(...);
ctx.fillText(shortLabel(v), ...)
```

替换为：
```ts
if (v === null) {
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(left + 1, top + 1, s - 2, s - 2);
} else {
  // cell background for alignment
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  ctx.fillRect(left + 1, top + 1, s - 2, s - 2);
  drawStickerInCell(ctx, v, left, top, s);
}
```

并删除 `shortLabel()` / `colorFor()`（如果不再使用）。

- [ ] **Step 4: 手动自测**

Run:
```bash
npm run dev
```
检查：
- 棋盘 tile 显示为贴纸图标
- 选中/提示/连线路径仍正常

- [ ] **Step 5: 单测 + typecheck**

Run:
```bash
npm test && npm run typecheck
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/scenes/MatchScene.ts
git commit -m "feat(ui): render match tiles with sticker icons"
```

---

## Task 3: 胜利结算明细行加材料 icon

**Files:**
- Modify: `src/ui/scenes/MatchScene.ts`

- [ ] **Step 1: 在 showWinOverlay() 中每行加 `<img>`**

找到：
```ts
<span>${r.name}</span>
```

替换为（保持 inline style 简洁）：
```ts
<span style="display:flex; align-items:center; gap:8px;">
  <img alt="" src="${import.meta.env.BASE_URL}ui/stickers/${r.id}.png" style="width:22px; height:22px;" />
  ${r.name}
</span>
```

注：`formatMaterialDelta()` 返回里已有 `id: MaterialId`（若没有则改 `src/ui/victorySummary.ts` 让其返回）。

- [ ] **Step 2: 自测**

通关 → 看胜利结算是否出现 icon。

- [ ] **Step 3: 测试**

Run:
```bash
npm test && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/scenes/MatchScene.ts
git commit -m "feat(ui): add sticker icons to victory summary"
```

---

## Task 4: GardenScene 材料库存加 icon

**Files:**
- Modify: `src/ui/scenes/GardenScene.ts`

- [ ] **Step 1: 修改 renderMaterials() 行模板**

把：
```ts
<span>${m.name}</span>
```
改为：
```ts
<span style="display:flex; align-items:center; gap:8px;">
  <img alt="" src="${import.meta.env.BASE_URL}ui/stickers/${m.id}.png" style="width:22px; height:22px;" />
  ${m.name}
</span>
```

- [ ] **Step 2: 测试**

Run:
```bash
npm test && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/scenes/GardenScene.ts
git commit -m "feat(ui): show material sticker icons in garden inventory"
```

---

## Task 5: GardenScene 工作台配方/需求加 icon

**Files:**
- Modify: `src/ui/scenes/GardenScene.ts`

- [ ] **Step 1: 配方标题加装饰 icon**

在 `renderCrafting()` 的配方标题：
```ts
<div style="font-weight:600;">${name}</div>
```
改为：
```ts
<div style="font-weight:600; display:flex; align-items:center; gap:8px;">
  <img alt="" src="${import.meta.env.BASE_URL}ui/stickers/${r.decorationId}.png" style="width:22px; height:22px;" />
  ${name}
</div>
```

- [ ] **Step 2: 需求行加材料 icon**

把需求行中：
```ts
<span>${getMaterialName(mid as MaterialId)}</span>
```
改为：
```ts
<span style="display:flex; align-items:center; gap:8px;">
  <img alt="" src="${import.meta.env.BASE_URL}ui/stickers/${mid}.png" style="width:18px; height:18px;" />
  ${getMaterialName(mid as MaterialId)}
</span>
```

- [ ] **Step 3: 自测**

回花园 → 工作台合成区域：
- 标题 icon 正确（bench/pond/tree）
- 需求行 icon 正确（wood/stone/water/leaf）

- [ ] **Step 4: 测试 + 提交**

Run:
```bash
npm test && npm run typecheck
```

Commit:
```bash
git add src/ui/scenes/GardenScene.ts
git commit -m "feat(ui): add sticker icons to crafting bench"
```

---

## Task 6: GardenScene 装饰背包按钮加 icon

**Files:**
- Modify: `src/ui/scenes/GardenScene.ts`
- Modify: `src/ui/renderers.ts`（如果 renderDecorationButton 在这里；否则按实际文件）

- [ ] **Step 1: 定位 renderDecorationButton 定义**

Search:
```bash
npm -s run -c "true"
```
（用 `rg "function renderDecorationButton" src -n` 找到定义文件）

- [ ] **Step 2: 在按钮 label 前插入 `<img>`**

示例（伪代码，按实际 HTML 结构嵌入）：
```ts
<img alt="" src="${import.meta.env.BASE_URL}ui/stickers/${def.id}.png" style="width:20px; height:20px; margin-right:8px;" />
```

- [ ] **Step 3: 测试 + 提交**

Run:
```bash
npm test && npm run typecheck
```

Commit:
```bash
git add src/ui/scenes/GardenScene.ts src/ui/*.ts
git commit -m "feat(ui): add sticker icons to decoration bag buttons"
```

---

## Task 7: 最终验收（本地 + Pages）

**Files:**
- Modify:（可能无）

- [ ] **Step 1: 本地构建**

Run:
```bash
npm run build
```
Expected: SUCCESS

- [ ] **Step 2: 本地预览**

Run:
```bash
npm run preview -- --host 0.0.0.0 --port 4173
```
Expected: 页面能打开，图标均能加载。

- [ ] **Step 3: 推送 main（触发 Pages）**

```bash
git push origin main
```

- [ ] **Step 4: 线上验证**

打开 GH Pages：
`https://zhuoweishun.github.io/plant-lianliankan/`

检查：
- 棋盘 tile 有贴纸图标
- 胜利结算材料明细有贴纸 icon
- 花园材料库存、工作台合成、装饰背包均有 icon

