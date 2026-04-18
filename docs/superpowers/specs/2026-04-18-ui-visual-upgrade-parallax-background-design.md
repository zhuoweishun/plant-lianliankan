# UI 视觉升级：春日清晨插画背景 + 多层视差动效（设计稿）

日期：2026-04-18  
项目：plant-garden-link-match  
范围：整体画面美化（花园场景 + 配对棋盘场景），在不影响可玩性/可读性的前提下，让画面更“像游戏”。

---

## 1. 目标与已确认决策

### 1.1 目标
- **花园像花园**：草地/小路/装饰氛围更明确；网格像“草坪地块”，而不是纯 UI。
- **棋盘像桌游**：棋盘放在“木桌/托盘”上，周围有轻量贴纸/胶带点缀。
- **整体大背景更丰富**：春日清晨氛围，柔光、花粉/光斑、云朵等轻动效。
- **保持玩法清晰**：棋盘 tile 与连线反馈始终最清晰，背景永远低对比不抢眼。

### 1.2 已确认决策（来自用户）
- 总风格：**治愈纸感贴纸**
- 背景方向：**A 大场景插画背景**
- 氛围：**春日清晨**
- 动效档位：**重动效**
- 背景分配：**花园/棋盘两张不同场景**
- 技术路线：**CSS 多层视差（推荐方案）**，不采用 Canvas 背景渲染器/视频背景

---

## 2. 方案概述（CSS 多层视差）

### 2.1 基本思路
每个场景使用 3～5 张透明 PNG 作为背景分层（从远到近）：
- Layer 1：天空渐变/柔光（几乎静止）
- Layer 2：远景（远山/远树线，极低对比）
- Layer 3：中景（灌木/花点/小装饰，轻微视差）
- Layer 4：前景（草地/小路/桌面纹理/棋盘托盘边缘）
- Layer 5：粒子层（花粉/光斑）+ 云朵层（可选），慢速漂移

动效用 CSS `transform`（或 `background-position`）做低频移动 + 小幅视差：
- 云朵：横向慢漂
- 花粉/光斑：轻微上浮/飘动，随机延迟
- 视差：根据鼠标/手指位置（或仅定时）做极小位移（例如 2～12px）

### 2.2 可访问性与性能约束
- `prefers-reduced-motion: reduce` 时 **自动关闭动效**（仅保留静态背景）。
- 动效帧率不强求 60fps，但必须流畅且不影响交互；优先使用 GPU 友好的 `transform`。
- 背景层不拦截点击：`pointer-events: none`。
- 背景层永远在 UI 下方，HUD/棋盘可读性优先。

---

## 3. 场景视觉设计（具体长相与层级）

## 3.1 花园场景（GardenScene）

**视觉叙事：**春日清晨的花园一角，草地柔和、远处有树和天空，近处有小路与花点。

**背景层建议：**
1. `garden_sky.png`：天空渐变 + 极淡太阳柔光（固定）
2. `garden_far.png`：远山/远树线（低对比）
3. `garden_mid.png`：灌木/零散花点（轻微视差）
4. `garden_fore.png`：近景草地 + 小路（较清晰，但避开 HUD 主要阅读区）
5. `garden_particles.png`：花粉/光斑（可重复平铺或大画布）

**花园网格（“像草坪地块”）：**
- 当前网格 cell 以纯色/线框为主；升级为：
  - 每格使用“草坪地块”纹理（可通过 CSS pattern 或单张 tile texture 平铺）
  - 每格边界线更柔和（纸感描边/低对比）
  - hover/预览框：改为白描边+柔光，而不是强硬高亮

**落地感：**
- 已放置装饰在草地上需要一致的投影/接触阴影（软、浅，不要黑边）。

## 3.2 棋盘场景（MatchScene）

**视觉叙事：**桌游台面风格：木桌 + 纸板/木框托盘上摆着贴纸 tile。

**背景层建议：**
1. `match_skyhint.png`：非常淡的远景春日氛围（可选）
2. `match_table.png`：木桌面纹理（横向木纹，几乎静止）
3. `match_tray.png`：棋盘托盘/木框/纸板底（静止）
4. `match_decor.png`：角落贴纸/胶带/小叶子点缀（极轻视差）
5. `match_particles.png`：极少量光斑（比花园更克制，避免抢棋盘）

**棋盘可读性规则：**
- 背景层对比永远低于 tile 卡片与贴纸（tile 必须是第一视觉焦点）
- 连线（提示路径）仍需保持亮度/对比（不能被背景吞掉）

---

## 4. 资源与路径规范

### 4.1 资源路径
建议新增：
- `public/ui/backgrounds/garden/*.png`
- `public/ui/backgrounds/match/*.png`

贴纸资源维持：
- `public/ui/stickers/*.png`

### 4.2 引用方式
所有 public 资源必须通过：
- `import.meta.env.BASE_URL + "ui/..."`  
以兼容 `vite.config.ts base: "./"` 的 GitHub Pages 部署。

---

## 5. UI 结构改动建议（不写代码，仅说明要改哪里）

### 5.1 DOM 结构（每个 Scene）
在 scene 根节点下增加一个背景容器（示意）：
```html
<div class="scene scene--garden">
  <div class="scene-bg" aria-hidden="true">
    <div class="bg-layer bg-layer--sky"></div>
    <div class="bg-layer bg-layer--far"></div>
    <div class="bg-layer bg-layer--mid"></div>
    <div class="bg-layer bg-layer--fore"></div>
    <div class="bg-layer bg-layer--particles"></div>
  </div>
  <!-- 现有 app-shell 保持 -->
  <div class="app-shell">...</div>
</div>
```

### 5.2 CSS 约束
- `.scene` 占满视口并作为背景定位锚点
- `.scene-bg` `position: fixed; inset: 0; z-index: -1; pointer-events:none;`
- `.bg-layer` 使用 `background-image` + `background-size: cover`（或 contain，根据画面）
- 视差位移只做小幅（2～12px），避免“晕”与不适
- 在小屏（<860px）要保证 HUD 与棋盘不被背景干扰

### 5.3 动效控制（重动效但可控）
建议两档开关：
1) 自动：`prefers-reduced-motion: reduce` 关闭全部动画  
2) 手动：后续可加一个“动效开关”（非本次强制）

---

## 6. 验收标准

1. 花园与棋盘各有独立背景，整体统一为“春日清晨”调色。  
2. 花园网格视觉升级为草坪地块风格，放置物在地面有落地感。  
3. 棋盘像桌游台面：木桌/托盘明显，但不影响 tile 可读性与连线提示。  
4. 重动效实现：云/花粉/光斑/轻视差至少 2 种动效同时存在，且不抢戏。  
5. 开启系统“减少动态效果”时，动效自动关闭且画面仍好看。  
6. 性能：交互无明显卡顿；页面滚动/点击无延迟感。  
7. GitHub Pages 部署路径正确（所有背景与贴纸资源都能加载）。

---

## 7. 非目标（本次不做）
- 不做音效/音乐系统
- 不做复杂粒子引擎或 WebGL
- 不做多倍率切图（2x/3x）与资源压缩管线（如需后续再加）

