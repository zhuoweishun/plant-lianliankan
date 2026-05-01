# UI 视觉升级：贴纸图标接入（设计稿）

日期：2026-04-17  
范围：plant-garden-link-match（Match 棋盘 + Garden 面板 + 胜利结算）

---

## 1. 目标

用一套统一的「治愈自然系贴纸 PNG」替换当前的纯色块/文字 UI，让玩家：
- 一眼识别材料与装饰（更像成品游戏）
- 胜利结算与花园工作台的“收集→合成→摆放”链路更清晰

---

## 2. 资产规范（已确定）

### 2.1 资源路径
放在 `public/ui/stickers/*.png`（透明背景 PNG）：

**材料（MaterialId）**
- `wood.png`
- `stone.png`
- `water.png`
- `leaf.png`

**装饰（DecorationId）**
- `bench.png`
- `pond.png`
- `tree.png`

### 2.2 风格约束
- 贴纸白边 + 轻阴影（已烘焙在 PNG 内）
- 描边色倾向：
  - wood：暖棕
  - stone：中灰
  - water：蓝
  - leaf：绿
- 透明背景必须干净（无“棋盘格假透明”、无残留黑边、无水印）

---

## 3. 接入范围（UI 改动点）

### 3.1 MatchScene（棋盘）
当前：格子纯色块 + 文字 `shortLabel()`  
目标：格子绘制为“圆角卡片底 + 贴纸图标”

建议样式：
- 棋盘背景维持深色
- 每个 tile：
  - 圆角卡片底（浅色、轻微内阴影/高光）
  - 居中绘制贴纸图标（不再绘制文字，或仅在 Debug 模式显示）

### 3.2 胜利结算（MatchScene win-summary）
当前：仅文字 + 数字  
目标：每一行左侧展示材料贴纸图标（wood/stone/water/leaf），右侧 `+数量`

### 3.3 GardenScene（花园侧栏）
接入位置：
1) **材料库存（materials-inv）**：每行加 icon  
2) **工作台合成（crafting-bench）**
   - 配方条目标题左侧加装饰 icon（bench/pond/tree）
   - 每条材料需求行左侧加材料 icon
3) **装饰背包列表（decorations-list）**：按钮上加装饰 icon

---

## 4. 代码结构（建议）

新增一个轻量资产模块（避免散落 hardcode）：

`src/ui/stickers.ts`
```ts
export type StickerId =
  | "wood" | "stone" | "water" | "leaf"
  | "bench" | "pond" | "tree";

export function stickerUrl(id: StickerId): string {
  // public 资源：用 BASE_URL/相对路径兼容 GH Pages base="./"
  return `${import.meta.env.BASE_URL}ui/stickers/${id}.png`;
}

export function preloadStickers(ids: readonly StickerId[]): Promise<void>;
export function getStickerImage(id: StickerId): HTMLImageElement | undefined;
```

说明：
- MatchScene Canvas 渲染需预加载并缓存 `Image`，避免每帧 `new Image()`
- GardenScene 使用 `<img>` 直接展示（浏览器会缓存），无需复杂预加载

---

## 5. 验收标准

1) 7 张贴纸 PNG 在深色/浅色背景下均无明显脏边、无水印残留。  
2) MatchScene 棋盘格子不再是纯色块+文字，而是“卡片底+贴纸图标”，且滚动/重绘不卡顿。  
3) 胜利结算明细、花园材料库存、工作台配方/需求行、装饰背包按钮均展示对应 icon。  
4) GitHub Pages 构建正常（路径引用不因 `base: "./"` 失效）。  

---

## 6. 非目标（本次不做）
- 不做动画资源（粒子/飘字/弹跳）  
- 不引入外部 UI 框架/复杂主题系统  
- 不做高分辨率多倍率切图（先用 1 套 PNG，后续再加 2x/3x）  

