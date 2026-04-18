# 春日清晨插画背景 + 多层视差动效 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为花园与配对棋盘分别加入“春日清晨”插画大背景，并用 CSS 多层视差 + 粒子/云朵动效增强氛围，同时保证棋盘可读性与交互性能。

**Architecture:**  
1) Scene 根节点增加统一的 `.scene` 与 `.scene-bg` 多层背景 DOM；  
2) 背景渲染采用 CSS（cover 图 + 纹理叠层 + 关键帧动效 + JS 写入少量 CSS 变量做视差）；  
3) `prefers-reduced-motion` 自动降级：关闭动效，保留静态背景；  
4) 资源全部放在 `public/ui/backgrounds/...`，通过 `import.meta.env.BASE_URL` 引用以兼容 GH Pages `base=./`。

**Tech Stack:** TypeScript + Vite + DOM + CSS Animations + Vitest

---

## 0. 文件结构与改动点（锁定边界，避免屎山）

**Create**
- `src/ui/publicUrl.ts`：统一 public 资源路径拼接（BASE_URL）
- `src/ui/parallax.ts`：轻量视差变量写入（requestAnimationFrame 节流）
- `public/ui/backgrounds/garden/*`：花园背景资源
- `public/ui/backgrounds/match/*`：棋盘背景资源

**Modify**
- `src/ui/stickers.ts`：复用 `publicUrl()`（保持路径一致）
- `src/ui/scenes/GardenScene.ts`：包一层 `.scene scene--garden` + 背景层 DOM + 挂载视差
- `src/ui/scenes/MatchScene.ts`：包一层 `.scene scene--match` + 背景层 DOM + 挂载视差
- `src/styles.css`：新增 `.scene`、背景层、动效、降级规则、以及两套场景的图片绑定

**Tests**
- `tests/publicUrl.test.ts`
- `tests/parallax.test.ts`

---

## Task 1: 增加 publicUrl()（BASE_URL 资源路径统一）

**Files:**
- Create: `src/ui/publicUrl.ts`
- Modify: `src/ui/stickers.ts`
- Modify: `tests/stickers.test.ts`
- Test: `tests/publicUrl.test.ts`

- [ ] **Step 1: 写 failing test（publicUrl 拼接）**

创建 `tests/publicUrl.test.ts`：
```ts
import { describe, expect, it } from "vitest";

describe("publicUrl", () => {
  it("appends path to BASE_URL", async () => {
    const { publicUrl } = await import("../src/ui/publicUrl.ts");
    expect(publicUrl("ui/stickers/wood.png")).toMatch(/ui\/stickers\/wood\.png$/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
npm test -- tests/publicUrl.test.ts
```
Expected: FAIL（因为 `src/ui/publicUrl.ts` 不存在）

- [ ] **Step 3: 实现 publicUrl.ts**

创建 `src/ui/publicUrl.ts`：
```ts
/**
 * 拼接 public 资源路径，必须走 BASE_URL，兼容 GitHub Pages base=./
 */
export function publicUrl(path: string): string {
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${import.meta.env.BASE_URL}${p}`;
}
```

- [ ] **Step 4: stickers.ts 改为复用 publicUrl**

修改 `src/ui/stickers.ts`（完整替换相关片段）：
```ts
import { publicUrl } from "./publicUrl.ts";
// ...
export function stickerUrl(id: StickerId): string {
  return publicUrl(`ui/stickers/${id}.png`);
}
```

- [ ] **Step 5: 运行全量测试与类型检查**

Run:
```bash
npm test && npm run typecheck
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/publicUrl.ts src/ui/stickers.ts tests/publicUrl.test.ts tests/stickers.test.ts
git commit -m "refactor(ui): add publicUrl helper for BASE_URL assets"
```

---

## Task 2: 轻量视差模块（parallax.ts）

**Files:**
- Create: `src/ui/parallax.ts`
- Test: `tests/parallax.test.ts`

- [ ] **Step 1: 写 failing test（写入 CSS variables）**

创建 `tests/parallax.test.ts`：
```ts
import { describe, expect, it, vi } from "vitest";

describe("parallax", () => {
  it("updates css vars on pointer move", async () => {
    // 默认不 reduce motion
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const { attachParallax } = await import("../src/ui/parallax.ts");

    const el = document.createElement("div");
    Object.defineProperty(el, "clientWidth", { value: 100, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: 100, configurable: true });

    const detach = attachParallax(el, { strengthPx: 12 });

    el.dispatchEvent(new PointerEvent("pointermove", { clientX: 100, clientY: 0 }));
    // 等待 rAF
    await new Promise((r) => setTimeout(r, 0));

    expect(el.style.getPropertyValue("--px1")).toBeTruthy();
    expect(el.style.getPropertyValue("--py1")).toBeTruthy();

    detach();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
npm test -- tests/parallax.test.ts
```
Expected: FAIL（因为 `src/ui/parallax.ts` 不存在）

- [ ] **Step 3: 实现 parallax.ts（无乘法 calc，直接写多组变量）**

创建 `src/ui/parallax.ts`：
```ts
type ParallaxOptions = {
  strengthPx: number;
};

/**
 * 给一个容器写入多组 CSS 变量（--px1/--py1/...），供不同深度的层做 translate。
 * - 使用 requestAnimationFrame 节流
 * - prefers-reduced-motion 自动禁用
 */
export function attachParallax(el: HTMLElement, options: ParallaxOptions): () => void {
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return () => {};

  const strength = options.strengthPx;
  let raf = 0;
  let lastX = 0;
  let lastY = 0;

  const apply = () => {
    raf = 0;
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    const nx = (lastX / w - 0.5) * 2; // -1..1
    const ny = (lastY / h - 0.5) * 2; // -1..1

    // 4 层深度：远->近
    const d1 = 0.15,
      d2 = 0.35,
      d3 = 0.6,
      d4 = 1.0;

    el.style.setProperty("--px1", `${nx * strength * d1}px`);
    el.style.setProperty("--py1", `${ny * strength * d1}px`);
    el.style.setProperty("--px2", `${nx * strength * d2}px`);
    el.style.setProperty("--py2", `${ny * strength * d2}px`);
    el.style.setProperty("--px3", `${nx * strength * d3}px`);
    el.style.setProperty("--py3", `${ny * strength * d3}px`);
    el.style.setProperty("--px4", `${nx * strength * d4}px`);
    el.style.setProperty("--py4", `${ny * strength * d4}px`);
  };

  const onMove = (e: PointerEvent) => {
    // 使用 clientX/Y 的相对位置：假设 el 全屏或接近全屏
    lastX = e.clientX;
    lastY = e.clientY;
    if (!raf) raf = requestAnimationFrame(apply);
  };

  const onLeave = () => {
    lastX = (el.clientWidth || 1) / 2;
    lastY = (el.clientHeight || 1) / 2;
    if (!raf) raf = requestAnimationFrame(apply);
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerleave", onLeave);
  // 初始居中
  onLeave();

  return () => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerleave", onLeave);
    if (raf) cancelAnimationFrame(raf);
  };
}
```

- [ ] **Step 4: 运行全量测试**

Run:
```bash
npm test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/parallax.ts tests/parallax.test.ts
git commit -m "feat(ui): add lightweight parallax helper"
```

---

## Task 3: 创建背景资源（两套场景）

> 说明：这一步会生成/添加大图片资源。为了可控与可读性，本计划先生成“可用的第一版”，后续你可以继续迭代细节。

**Files:**
- Create: `public/ui/backgrounds/garden/*`
- Create: `public/ui/backgrounds/match/*`

- [ ] **Step 1: 创建目录**

Run:
```bash
mkdir -p public/ui/backgrounds/garden public/ui/backgrounds/match
```

- [ ] **Step 2: 生成两张“主背景”**

生成（建议尺寸 1024x576，cover 填充；可在未来替换为更高分辨率）：
- `public/ui/backgrounds/garden/base.jpg`（春日清晨花园大场景：天空、远景树线、草地、小路）
- `public/ui/backgrounds/match/base.jpg`（桌游台面：木桌纹理 + 轻微春日氛围）

（执行时使用图片生成工具；若工具只输出 jpg 则先用 jpg，后续可再转 png。）

- [ ] **Step 3: 生成前景/托盘与点缀**

生成：
- `public/ui/backgrounds/match/tray.png`（棋盘托盘/木框/纸板底，允许透明更佳；若无法透明则做完整画面叠层）
- `public/ui/backgrounds/garden/fore.png`（花园近景花点/小装饰，允许透明更佳）

- [ ] **Step 4: 生成粒子贴图（可用 PNG 或 SVG dataURL，优先 PNG）**

生成：
- `public/ui/backgrounds/garden/particles.png`（稀疏花粉/光斑）
- `public/ui/backgrounds/match/particles.png`（更稀疏、更克制的光斑）

- [ ] **Step 5: Commit（资源入库）**

```bash
git add public/ui/backgrounds
git commit -m "chore(assets): add spring morning background layers"
```

---

## Task 4: CSS 场景框架 + 动效 + 降级规则

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: 新增 scene 与 bg-layer 通用样式**

在 `src/styles.css` 末尾追加：
```css
.scene {
  position: relative;
  min-height: 100svh;
  width: 100%;
}

.scene-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
}

.bg-layer {
  position: absolute;
  inset: -32px; /* 给视差留出缓冲，避免露边 */
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  transform: translate3d(0, 0, 0);
  will-change: transform, opacity, background-position;
}

/* 视差变量（由 JS 写入） */
.bg-layer.depth-1 { transform: translate3d(var(--px1, 0px), var(--py1, 0px), 0); }
.bg-layer.depth-2 { transform: translate3d(var(--px2, 0px), var(--py2, 0px), 0); }
.bg-layer.depth-3 { transform: translate3d(var(--px3, 0px), var(--py3, 0px), 0); }
.bg-layer.depth-4 { transform: translate3d(var(--px4, 0px), var(--py4, 0px), 0); }

@keyframes drift-x {
  from { background-position: 0% 50%; }
  to   { background-position: 100% 50%; }
}

@keyframes float-y {
  0%   { transform: translate3d(var(--px3, 0px), calc(var(--py3, 0px) + 0px), 0); }
  50%  { transform: translate3d(var(--px3, 0px), calc(var(--py3, 0px) - 10px), 0); }
  100% { transform: translate3d(var(--px3, 0px), calc(var(--py3, 0px) + 0px), 0); }
}

/* 动效降级：系统要求减少动效时关闭动画 */
@media (prefers-reduced-motion: reduce) {
  .bg-layer {
    animation: none !important;
  }
}
```

- [ ] **Step 2: 花园/棋盘两套背景绑定**

同样在 `src/styles.css` 追加（用 BASE_URL，保持一致性）：
```css
.scene--garden .bg-layer--base {
  background-image: url("./ui/backgrounds/garden/base.jpg");
}
.scene--garden .bg-layer--fore {
  background-image: url("./ui/backgrounds/garden/fore.png");
  opacity: 0.9;
}
.scene--garden .bg-layer--particles {
  background-image: url("./ui/backgrounds/garden/particles.png");
  background-repeat: repeat;
  background-size: 420px 420px;
  opacity: 0.45;
  animation: drift-x 28s linear infinite;
}

.scene--match .bg-layer--base {
  background-image: url("./ui/backgrounds/match/base.jpg");
}
.scene--match .bg-layer--tray {
  background-image: url("./ui/backgrounds/match/tray.png");
  opacity: 0.95;
}
.scene--match .bg-layer--particles {
  background-image: url("./ui/backgrounds/match/particles.png");
  background-repeat: repeat;
  background-size: 520px 520px;
  opacity: 0.18;
  animation: drift-x 40s linear infinite;
}
```

说明：这里用相对路径是 Vite 推荐方式（会被打包处理）。不直接写 `import.meta.env.BASE_URL` 在 CSS 中。

- [ ] **Step 3: 运行构建确认 CSS 中资源可解析**

Run:
```bash
npm run build
```
Expected: SUCCESS

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "feat(ui): add scene background layers and parallax animations"
```

---

## Task 5: GardenScene / MatchScene 注入背景层 DOM + 绑定视差

**Files:**
- Modify: `src/ui/scenes/GardenScene.ts`
- Modify: `src/ui/scenes/MatchScene.ts`

- [ ] **Step 1: GardenScene 包裹 scene + 背景层 DOM**

修改 `GardenScene.mount()` 的模板：用 `.scene scene--garden` 包住原有 `.app-shell`，并在最前插入 `.scene-bg`：
```html
<div class="scene scene--garden">
  <div class="scene-bg" aria-hidden="true">
    <div class="bg-layer depth-1 bg-layer--base"></div>
    <div class="bg-layer depth-3 bg-layer--fore"></div>
    <div class="bg-layer depth-2 bg-layer--particles"></div>
  </div>
  <div class="app-shell">...原内容...</div>
</div>
```

- [ ] **Step 2: MatchScene 包裹 scene + 背景层 DOM**

同理在 `MatchScene.mount()`：使用 `.scene scene--match` + layers：
```html
<div class="scene scene--match">
  <div class="scene-bg" aria-hidden="true">
    <div class="bg-layer depth-1 bg-layer--base"></div>
    <div class="bg-layer depth-3 bg-layer--tray"></div>
    <div class="bg-layer depth-2 bg-layer--particles"></div>
  </div>
  <div class="app-shell">...原内容...</div>
</div>
```

- [ ] **Step 3: 两个 Scene 挂载 attachParallax()，并在 unmount 时释放**

在两处 scene 类里增加字段：
```ts
private detachParallax: null | (() => void) = null;
```

mount 后：
```ts
import { attachParallax } from "../parallax.ts";
// ...
this.detachParallax = attachParallax(sceneRootEl, { strengthPx: 14 });
```

unmount 时：
```ts
this.detachParallax?.();
this.detachParallax = null;
```

- [ ] **Step 4: 全量测试 + 构建**

Run:
```bash
npm test && npm run typecheck && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/scenes/GardenScene.ts src/ui/scenes/MatchScene.ts
git commit -m "feat(ui): add parallax scene backgrounds to garden and match"
```

---

## Task 6: 最终验收（本地预览）

**Files:**
- (no code)

- [ ] **Step 1: 启动 dev server**

Run:
```bash
npm run dev -- --host 0.0.0.0 --port 4173
```

- [ ] **Step 2: 验收清单**

检查：
1) 花园背景是春日清晨大场景，网格/贴纸仍清晰  
2) 棋盘背景是桌游台面风格，tile 最清晰  
3) 背景有明显“重动效”（粒子漂移 + 轻微视差）  
4) 系统开启“减少动态效果”后动效关闭  
5) 交互无明显卡顿（点击 tile、拖拽物品都正常）

---

## 执行方式选择

Plan 已准备好。两种执行方式：

1) **Subagent-Driven（推荐）**：我按 Task 拆分执行、每个 Task 结束让你在预览里验收确认再继续  
2) **Inline Execution**：我在当前会话直接按 Task 1→6 顺序做完

你希望我用哪一种？

