# 胜利结算面板升级：材料明细 + 去工作台合成（设计稿）

日期：2026-04-17  
范围：plant-garden-link-match（材料掉落→合成装饰版本）

---

## 1. 目标

在对局胜利弹窗中：
1) 展示「本局获得材料明细」（wood/stone/water/leaf，仅显示 >0 的项）。  
2) 提供按钮「去工作台合成」：点击后回到花园，并自动定位到工作台合成区域（滚动到可见 + 1.2s 高亮），让玩家更清楚“为什么变强”和“下一步做什么”。  

---

## 2. 交互与行为

### 2.1 胜利弹窗新增内容
- 标题：胜利！
- 新增区块：本局材料获得
  - 列表项：材料名 + `+数量`
  - 仅渲染数量 > 0 的材料
- 新增按钮：去工作台合成

### 2.2 点击「去工作台合成」
- 行为等价于“胜利结算并回花园”，但额外携带一次性的 UI 意图：`focusCrafting = true`
- 结算规则不变：只有胜利才结算材料进入存档

---

## 3. 数据流与接口变更

### 3.1 MatchScene → AppController 回调
当前 `onGoGarden` payload：`{ award: boolean; sessionInventory: InventoryJSON }`

扩展为：
```ts
{
  award: boolean;
  sessionInventory: InventoryJSON;
  focusCrafting?: boolean; // 默认 false/undefined
}
```

当用户点击“去工作台合成”：
- `award = true`
- `focusCrafting = true`

### 3.2 AppController → GardenScene
扩展 GardenScene options：
```ts
{
  onGoMatch?: (levelId: LevelId) => void;
  focusCrafting?: boolean; // 仅本次 mount 生效，不写入存档
}
```

---

## 4. UI 定位与高亮细节

### 4.1 定位
GardenScene mount 后，如果 `focusCrafting` 为 true：
- `crafting-bench` 容器调用 `scrollIntoView({ behavior: "smooth", block: "start" })`

### 4.2 高亮
定位后对 `crafting-bench` 临时添加样式（例如 outline + 发光背景）：
- 持续 ~1200ms
- 不引入复杂动画库，直接用行内 style 或 className + setTimeout

---

## 5. 验收标准
1) 胜利弹窗能正确展示本局材料明细（与 Debug JSON 中 sessionInventory 一致）。  
2) 点击「去工作台合成」会回花园，并自动滚到工作台区域且高亮闪一下。  
3) 结算规则不变（仍然仅胜利写入材料）。  
4) 不新增复杂状态系统：`focusCrafting` 是一次性 UI 意图，不进入 save。  

