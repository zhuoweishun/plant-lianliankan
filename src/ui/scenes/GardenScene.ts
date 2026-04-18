import { DECORATIONS, type DecorationDef, type DecorationId } from "../../data/decorations.ts";
import { LEVELS, type LevelId } from "../../data/levels.ts";
import { MATERIALS, getMaterialName, type MaterialId } from "../../data/materials.ts";
import { RECIPES } from "../../data/recipes.ts";
import { canCraftOne, craftOne } from "../../core/crafting/crafting.ts";
import { GardenGrid } from "../../garden/GardenGrid.ts";
import { isLevelUnlocked, loadSave, takeFromInventory, updateGarden, writeSave, type SaveData } from "../../save/save.ts";
import { gridCellFromClient, type GridMetrics } from "./gridHitTest.ts";
import { clampTopLeftToGrid, topLeftFromHover, type CellPoint } from "./dragSnap.ts";
import { stickerUrl } from "../stickers.ts";
import { attachParallax } from "../parallax.ts";
import { applySceneBackgrounds } from "../backgrounds.ts";

type GardenSceneOptions = {
  onGoMatch?: (levelId: LevelId) => void;
  focusCrafting?: boolean;
};

export class GardenScene {
  private root: HTMLElement | null = null;
  private detachParallax: null | (() => void) = null;
  private gridEl: HTMLDivElement | null = null;
  private listEl: HTMLDivElement | null = null;
  private levelListEl: HTMLDivElement | null = null;
  private materialsEl: HTMLDivElement | null = null;
  private craftingEl: HTMLDivElement | null = null;
  private modeEl: HTMLDivElement | null = null;
  private readonly options: GardenSceneOptions;

  // Placing from inventory
  private selected: DecorationId | null = null;
  // Moving an already placed decoration by index
  private movingIndex: number | null = null;
  // Hovered grid cell for preview
  private hoverCell: { x: number; y: number } | null = null;
  // Which cell inside the object is under the cursor/finger (for multi-cell objects)
  private grabOffset: CellPoint = { x: 0, y: 0 };
  private dragging: { kind: "place" | "move"; pointerId: number } | null = null;
  private suppressNextClick = false;

  private save: SaveData = loadSave();
  private garden = new GardenGrid<string>({ width: 10, height: 6 });
  private readonly gridMetrics: GridMetrics = { padding: 10, cell: 44, gap: 2, width: 10, height: 6 };

  constructor(options: GardenSceneOptions = {}) {
    this.options = options;
  }

  mount(root: HTMLElement): void {
    this.root = root;
    this.root.innerHTML = `
      <div class="scene scene--garden">
        <div class="scene-bg" aria-hidden="true">
          <div class="bg-layer depth-1 bg-layer--base"></div>
          <div class="bg-layer depth-2 bg-layer--particles"></div>
        </div>
        <div class="app-shell">
          <main class="board-pane">
            <div class="garden-grid" aria-label="garden grid"></div>
          </main>
          <aside class="hud-pane">
            <h2>花园</h2>
            <div class="hud-actions">
              <button type="button" class="btn" data-action="to-match">去配对（继续）</button>
            </div>
            <h2 style="margin-top: 12px;">关卡选择</h2>
            <div class="level-list" aria-label="level list"></div>

            <h2 style="margin-top: 12px;">材料库存</h2>
            <div class="materials-inv" aria-label="materials inventory"></div>

            <h2 style="margin-top: 12px;">工作台合成</h2>
            <div class="crafting-bench" aria-label="crafting bench"></div>

            <div class="garden-mode" style="margin-top: 10px;"></div>
            <h2 style="margin-top: 12px;">背包装饰</h2>
            <div class="garden-inv" aria-label="decorations list"></div>
            <p class="hud-hint">
              放置：先在右侧选择装饰 → 左侧出现虚拟框 → 点击格子放置（消耗 1 个）。<br />
              移动：点击花园里已摆放的物体 → 出现虚拟框 → 点击新位置移动；也可“放回背包”。
            </p>
          </aside>
        </div>
      </div>
    `;

    const grid = this.root.querySelector<HTMLDivElement>("div.garden-grid");
    const levelList = this.root.querySelector<HTMLDivElement>("div.level-list");
    const materials = this.root.querySelector<HTMLDivElement>("div.materials-inv");
    const crafting = this.root.querySelector<HTMLDivElement>("div.crafting-bench");
    const list = this.root.querySelector<HTMLDivElement>("div.garden-inv");
    const mode = this.root.querySelector<HTMLDivElement>("div.garden-mode");
    if (!grid || !levelList || !materials || !crafting || !list || !mode) {
      throw new Error("GardenScene mount failed: missing DOM nodes");
    }
    this.gridEl = grid;
    this.levelListEl = levelList;
    this.materialsEl = materials;
    this.craftingEl = crafting;
    this.listEl = list;
    this.modeEl = mode;

    this.root.addEventListener("click", this.onRootClick);
    this.root.addEventListener("pointerdown", this.onRootPointerDown);
    this.gridEl.addEventListener("mousemove", this.onGridMouseMove);
    this.gridEl.addEventListener("mouseleave", this.onGridMouseLeave);

    const scene = this.root.querySelector<HTMLElement>("div.scene.scene--garden");
    if (scene) {
      applySceneBackgrounds(scene, "garden");
      this.detachParallax = attachParallax(scene, { strengthPx: 14 });
    }

    this.restoreFromSave();
    this.render();
    if (this.options.focusCrafting) this.focusCraftingOnce();
  }

  unmount(): void {
    if (!this.root) return;
    this.detachParallax?.();
    this.detachParallax = null;
    this.root.removeEventListener("click", this.onRootClick);
    this.root.removeEventListener("pointerdown", this.onRootPointerDown);
    this.gridEl?.removeEventListener("mousemove", this.onGridMouseMove);
    this.gridEl?.removeEventListener("mouseleave", this.onGridMouseLeave);
    window.removeEventListener("pointermove", this.onWindowPointerMove);
    window.removeEventListener("pointerup", this.onWindowPointerUp);
    this.root.innerHTML = "";
    this.root = null;
    this.gridEl = null;
    this.levelListEl = null;
    this.materialsEl = null;
    this.craftingEl = null;
    this.listEl = null;
    this.modeEl = null;
  }

  private restoreFromSave(): void {
    const s = loadSave();
    this.save = s;
    try {
      this.garden = GardenGrid.fromJSON(s.garden);
      this.gridMetrics.width = this.garden.width;
      this.gridMetrics.height = this.garden.height;
    } catch {
      this.garden = new GardenGrid<string>({ width: 10, height: 6 });
    }
  }

  private readonly onRootClick = (e: MouseEvent): void => {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    const target = e.target as HTMLElement | null;
    const action = target?.getAttribute("data-action");
    if (action === "to-match") {
      this.options.onGoMatch?.("L1");
      return;
    }
    if (action === "return-to-bag") {
      this.returnSelectedPlacementToBag();
      return;
    }
    if (action === "craft") {
      const decoId = target?.getAttribute("data-craft-deco-id") as DecorationId | null;
      if (!decoId) return;
      this.tryCraft(decoId);
      return;
    }

    const lvlId = target?.getAttribute("data-level-id") as LevelId | null;
    if (lvlId) {
      if (lvlId === "T1" || isLevelUnlocked(this.save, lvlId)) this.options.onGoMatch?.(lvlId);
      return;
    }

    const decoId = target?.getAttribute("data-deco-id") as DecorationId | null;
    if (decoId) {
      this.selected = decoId;
      this.movingIndex = null;
      // Default grab offset when selecting (non-drag) is center-ish so it feels natural.
      const def = DECORATIONS.find((d) => d.id === decoId);
      if (def) this.grabOffset = { x: Math.floor(def.w / 2), y: Math.floor(def.h / 2) };
      this.renderDecorations();
      this.renderMode();
      this.renderGrid(); // update preview state
      return;
    }

    // Click in the grid (including clicking on overlays) => map by coordinates,
    // so the preview and the actual placement/move "lock" to the same cell.
    if (this.gridEl && target?.closest?.("div.garden-grid")) {
      const rect = this.gridEl.getBoundingClientRect();
      const cell = gridCellFromClient(e, { left: rect.left, top: rect.top }, this.gridMetrics);
      if (cell) this.tryActAt(cell.x, cell.y);
    }
  };

  private readonly onRootPointerDown = (e: PointerEvent): void => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Start dragging an existing placement (move)
    const placementEl = target.closest?.("[data-placement-index]") as HTMLElement | null;
    const placementIdxStr = placementEl?.getAttribute("data-placement-index");
    if (placementEl && placementIdxStr) {
      const idx = Number(placementIdxStr);
      if (!Number.isInteger(idx)) return;
      const p = this.garden.listPlacements()[idx];
      if (!p) return;

      this.movingIndex = idx;
      this.selected = null;

      // Determine which internal cell was grabbed (preserve "抓取点" semantics).
      // A grid item spanning w/h columns includes gaps; use our known step size.
      const rect = placementEl.getBoundingClientRect();
      const step = this.gridMetrics.cell + this.gridMetrics.gap;
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const gx = Math.max(0, Math.min(p.w - 1, Math.floor(localX / step)));
      const gy = Math.max(0, Math.min(p.h - 1, Math.floor(localY / step)));
      this.grabOffset = { x: gx, y: gy };

      this.beginDrag(e, "move", placementEl);
      return;
    }

    // Start dragging a decoration from inventory (place)
    const decoId = target.getAttribute("data-deco-id") as DecorationId | null;
    if (decoId) {
      const def = DECORATIONS.find((d) => d.id === decoId);
      if (!def) return;
      const count = this.save.inventory[def.id] ?? 0;
      if (count <= 0) return;

      this.selected = decoId;
      this.movingIndex = null;
      // No "grab point" from inventory; default to center-ish for natural drag.
      this.grabOffset = { x: Math.floor(def.w / 2), y: Math.floor(def.h / 2) };

      this.beginDrag(e, "place", target);
    }
  };

  private beginDrag(e: PointerEvent, kind: "place" | "move", captureEl: HTMLElement): void {
    this.dragging = { kind, pointerId: e.pointerId };
    this.suppressNextClick = true;

    try {
      captureEl.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    window.addEventListener("pointermove", this.onWindowPointerMove);
    window.addEventListener("pointerup", this.onWindowPointerUp);
    this.updateHoverFromPointer(e);
    this.render();
  }

  private readonly onWindowPointerMove = (e: PointerEvent): void => {
    if (!this.dragging || e.pointerId !== this.dragging.pointerId) return;
    this.updateHoverFromPointer(e);
    this.renderGrid();
  };

  private readonly onWindowPointerUp = (e: PointerEvent): void => {
    if (!this.dragging || e.pointerId !== this.dragging.pointerId) return;
    const kind = this.dragging.kind;
    this.dragging = null;
    window.removeEventListener("pointermove", this.onWindowPointerMove);
    window.removeEventListener("pointerup", this.onWindowPointerUp);

    if (!this.hoverCell) {
      // End drag; clear preview so it doesn't "stick" on last cell.
      this.hoverCell = null;
      this.render();
      return;
    }

    const topLeft = topLeftFromHover(this.hoverCell, this.grabOffset);
    if (kind === "move" && this.movingIndex !== null) {
      const can = this.garden.canMove(this.movingIndex, topLeft.x, topLeft.y);
      if (can) {
        this.garden.move(this.movingIndex, topLeft.x, topLeft.y);
        const next = updateGarden(this.save, this.garden.toJSON());
        this.save = next;
        writeSave(next);
      }
      // End move mode after dropping (prevents the preview box from persisting).
      this.movingIndex = null;
      this.hoverCell = null;
      this.render();
      return;
    }

    if (kind === "place" && this.selected) {
      const def = DECORATIONS.find((d) => d.id === this.selected);
      if (!def) {
        this.hoverCell = null;
        this.render();
        return;
      }
      const count = this.save.inventory[def.id] ?? 0;
      if (count <= 0) {
        this.hoverCell = null;
        this.render();
        return;
      }
      if (!this.garden.canPlace(topLeft.x, topLeft.y, def.w, def.h)) {
        // Keep selection, but clear stuck preview.
        this.hoverCell = null;
        this.render();
        return;
      }
      this.garden.place(def.id, topLeft.x, topLeft.y, def.w, def.h);
      const inventory = takeFromInventory(this.save.inventory, def.id, 1);
      const next = updateGarden({ ...this.save, inventory }, this.garden.toJSON());
      this.save = next;
      writeSave(next);
      // End place mode after dropping (so the ghost doesn't keep showing).
      this.selected = null;
      this.hoverCell = null;
      this.render();
    }
  };

  private updateHoverFromPointer(e: { clientX: number; clientY: number }): void {
    if (!this.gridEl) return;
    const rect = this.gridEl.getBoundingClientRect();
    const cell = gridCellFromClient(e, { left: rect.left, top: rect.top }, this.gridMetrics);
    this.hoverCell = cell;
  }

  private tryActAt(x: number, y: number): void {
    // Moving an existing placement
    if (this.movingIndex !== null) {
      const topLeft = topLeftFromHover({ x, y }, this.grabOffset);
      const can = this.garden.canMove(this.movingIndex, topLeft.x, topLeft.y);
      if (!can) return;
      this.garden.move(this.movingIndex, topLeft.x, topLeft.y);
      const next = updateGarden(this.save, this.garden.toJSON());
      this.save = next;
      writeSave(next);
      this.render();
      return;
    }

    // Placing from inventory
    if (!this.selected) return;
    const def = DECORATIONS.find((d) => d.id === this.selected);
    if (!def) return;

    const count = this.save.inventory[def.id] ?? 0;
    if (count <= 0) return;
    const topLeft = topLeftFromHover({ x, y }, this.grabOffset);
    if (!this.garden.canPlace(topLeft.x, topLeft.y, def.w, def.h)) return;

    this.garden.place(def.id, topLeft.x, topLeft.y, def.w, def.h);
    const inventory = takeFromInventory(this.save.inventory, def.id, 1);
    const next = updateGarden({ ...this.save, inventory }, this.garden.toJSON());
    this.save = next;
    writeSave(next);
    this.render();
  }

  private returnSelectedPlacementToBag(): void {
    if (this.movingIndex === null) return;
    const removed = this.garden.remove(this.movingIndex);
    // Add back 1 into inventory
    const nextInv = { ...this.save.inventory, [removed.id]: (this.save.inventory[removed.id] ?? 0) + 1 };
    const next = updateGarden({ ...this.save, inventory: nextInv }, this.garden.toJSON());
    this.save = next;
    this.movingIndex = null;
    writeSave(next);
    this.render();
  }

  private render(): void {
    this.renderGrid();
    this.renderLevels();
    this.renderMaterials();
    this.renderCrafting();
    this.renderDecorations();
    this.renderMode();
  }

  private renderGrid(): void {
    if (!this.gridEl) return;
    const cellPx = this.gridMetrics.cell;
    const gapPx = this.gridMetrics.gap;

    this.gridEl.innerHTML = "";
    this.gridEl.style.display = "grid";
    this.gridEl.style.gridTemplateColumns = `repeat(${this.garden.width}, ${cellPx}px)`;
    this.gridEl.style.gridTemplateRows = `repeat(${this.garden.height}, ${cellPx}px)`;
    this.gridEl.style.gap = `${gapPx}px`;
    this.gridEl.style.padding = "10px";
    // 草坪地块：用渐变模拟纸感草地（避免额外纹理资源与水印风险）
    this.gridEl.style.background = `
      radial-gradient(circle at 18% 22%, rgba(255,255,255,0.10) 0 1px, transparent 2px),
      radial-gradient(circle at 72% 30%, rgba(255,255,255,0.08) 0 1.2px, transparent 2.6px),
      radial-gradient(circle at 40% 68%, rgba(255,255,255,0.07) 0 1px, transparent 2.2px),
      linear-gradient(180deg, rgba(120, 180, 120, 0.35), rgba(70, 130, 90, 0.40))
    `;
    this.gridEl.style.backgroundSize = "220px 220px, 260px 260px, 240px 240px, auto";
    this.gridEl.style.backgroundRepeat = "repeat, repeat, repeat, no-repeat";
    this.gridEl.style.backgroundPosition = "0 0, 0 0, 0 0, center";
    this.gridEl.style.border = "1px solid rgba(255,255,255,0.12)";
    this.gridEl.style.borderRadius = "10px";

    // Base cells
    for (let y = 0; y < this.garden.height; y++) {
      for (let x = 0; x < this.garden.width; x++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn";
        // IMPORTANT:
        // Base cells must have fixed grid coordinates; otherwise CSS grid auto-placement
        // will "skip" cells occupied by placed decorations and reflow remaining cells,
        // causing the garden grid to look like it's changing shape.
        btn.style.gridColumn = `${x + 1}`;
        btn.style.gridRow = `${y + 1}`;
        btn.style.width = `${cellPx}px`;
        btn.style.height = `${cellPx}px`;
        btn.style.padding = "0";
        btn.style.borderRadius = "8px";
        btn.style.background = "rgba(255,255,255,0.06)";
        btn.style.borderColor = "rgba(255,255,255,0.14)";
        btn.style.cursor = this.selected || this.movingIndex !== null ? "pointer" : "default";
        btn.textContent = "";
        this.gridEl.appendChild(btn);
      }
    }

    // Placements (overlay by ordering)
    const placements = this.garden.listPlacements();
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i]!;
      const def = DECORATIONS.find((d) => d.id === (p.id as DecorationId));
      const card = document.createElement("button");
      card.type = "button";
      card.className = "btn";
      card.setAttribute("data-placement-index", String(i));
      card.style.gridColumn = `${p.x + 1} / span ${p.w}`;
      card.style.gridRow = `${p.y + 1} / span ${p.h}`;
      card.style.display = "grid";
      card.style.placeItems = "center";
      card.style.borderRadius = "10px";
      card.style.border = "1px solid rgba(0,0,0,0.2)";
      card.style.background = def?.color ?? "rgba(255,255,255,0.18)";
      card.style.color = "rgba(0,0,0,0.75)";
      card.style.fontSize = "12px";
      card.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      card.style.pointerEvents = "auto";
      card.style.cursor = "pointer";
      card.style.outline = i === this.movingIndex ? "3px solid #ffd166" : "none";
      card.textContent = def?.name ?? String(p.id);
      this.gridEl.appendChild(card);
    }

    this.renderPreview();
  }

  private renderDecorations(): void {
    if (!this.listEl) return;

    const items = DECORATIONS.map((d) => {
      const count = this.save.inventory[d.id] ?? 0;
      const selected = this.selected === d.id;
      const disabled = count <= 0;
      return renderDecorationButton(d, count, selected, disabled);
    });

    this.listEl.innerHTML = "";
    for (const el of items) this.listEl.appendChild(el);
  }

  private renderMaterials(): void {
    if (!this.materialsEl) return;
    const rows = MATERIALS.map((m) => {
      const have = this.save.materials?.[m.id] ?? 0;
      return `
        <div style="display:flex; justify-content:space-between; gap:10px; margin:6px 0; padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.18);">
          <span style="display:flex; align-items:center; gap:8px;">
            <img alt="" src="${stickerUrl(m.id)}" style="width:22px; height:22px;" />
            ${m.name}
          </span>
          <code>${have}</code>
        </div>
      `;
    }).join("");

    this.materialsEl.innerHTML = rows || `<div style="font-size:12px; color: rgba(255,255,255,0.7);">（暂无材料）</div>`;
  }

  private renderCrafting(): void {
    if (!this.craftingEl) return;

    const html = RECIPES.map((r) => {
      const def = DECORATIONS.find((d) => d.id === r.decorationId);
      const name = def?.name ?? r.decorationId;
      const can = canCraftOne(this.save.materials ?? {}, r.decorationId);

      const reqLines = Object.entries(r.requires)
        .filter(([, need]) => (need ?? 0) > 0)
        .map(([mid, need]) => {
          const have = this.save.materials?.[mid] ?? 0;
          const ok = have >= (need ?? 0);
          return `<div style="display:flex; justify-content:space-between; gap:10px; font-size:12px; color:${ok ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.65)"};">
            <span style="display:flex; align-items:center; gap:8px;">
              <img alt="" src="${stickerUrl(mid as MaterialId)}" style="width:18px; height:18px;" />
              ${getMaterialName(mid as MaterialId)}
            </span>
            <code>${have}/${need}</code>
          </div>`;
        })
        .join("");

      return `
        <div style="margin:8px 0; padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.22);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div style="font-weight:600; display:flex; align-items:center; gap:8px;">
              <img alt="" src="${stickerUrl(r.decorationId)}" style="width:22px; height:22px;" />
              ${name}
            </div>
            <button type="button" class="btn" data-action="craft" data-craft-deco-id="${r.decorationId}" ${can ? "" : "disabled"}>
              合成 1 个
            </button>
          </div>
          <div style="margin-top:8px; display:grid; gap:6px;">
            ${reqLines}
          </div>
        </div>
      `;
    }).join("");

    this.craftingEl.innerHTML = html || `<div style="font-size:12px; color: rgba(255,255,255,0.7);">（暂无配方）</div>`;
  }

  private tryCraft(decorationId: DecorationId): void {
    try {
      const out = craftOne(this.save.materials ?? {}, this.save.inventory ?? {}, decorationId);
      const next: SaveData = { ...this.save, materials: out.materials, inventory: out.decorations };
      this.save = next;
      writeSave(next);
      this.render();
    } catch {
      // not enough materials / unexpected
    }
  }

  private focusCraftingOnce(): void {
    const el = this.craftingEl;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    const prevOutline = el.style.outline;
    const prevShadow = el.style.boxShadow;
    el.style.outline = "3px solid rgba(255, 209, 102, 0.9)";
    el.style.boxShadow = "0 0 0 6px rgba(255, 209, 102, 0.18)";
    window.setTimeout(() => {
      el.style.outline = prevOutline;
      el.style.boxShadow = prevShadow;
    }, 1200);
  }

  private renderMode(): void {
    if (!this.modeEl) return;

    if (this.movingIndex !== null) {
      const p = this.garden.listPlacements()[this.movingIndex];
      const name = p ? (DECORATIONS.find((d) => d.id === (p.id as DecorationId))?.name ?? String(p.id)) : "（未知）";
      this.modeEl.innerHTML = `
        <div style="padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.22);">
          <div style="font-weight: 600; margin-bottom: 8px;">当前：移动模式</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.75); margin-bottom: 10px;">
            已选择：${name}（点击格子移动）
          </div>
          <button type="button" class="btn" data-action="return-to-bag">放回背包</button>
        </div>
      `;
      return;
    }

    if (this.selected) {
      const def = DECORATIONS.find((d) => d.id === this.selected);
      this.modeEl.innerHTML = `
        <div style="padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.22);">
          <div style="font-weight: 600;">当前：放置模式</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.75); margin-top: 6px;">
            已选择：${def?.name ?? this.selected}（${def?.w ?? "?"}×${def?.h ?? "?"}）
          </div>
        </div>
      `;
      return;
    }

    this.modeEl.innerHTML = `
      <div style="padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.18); color: rgba(255,255,255,0.75);">
        提示：点击右侧装饰进入放置；或点击花园中已摆放的物体进入移动。
      </div>
    `;
  }

  private readonly onGridMouseMove = (e: MouseEvent): void => {
    if (!this.gridEl) return;
    const rect = this.gridEl.getBoundingClientRect();
    const cell = gridCellFromClient(e, { left: rect.left, top: rect.top }, this.gridMetrics);
    if (!cell) {
      if (this.hoverCell) {
        this.hoverCell = null;
        this.renderGrid();
      }
      return;
    }
    if (this.hoverCell && this.hoverCell.x === cell.x && this.hoverCell.y === cell.y) return;
    this.hoverCell = cell;
    this.renderGrid();
  };

  private readonly onGridMouseLeave = (): void => {
    if (!this.hoverCell) return;
    this.hoverCell = null;
    this.renderGrid();
  };

  private renderPreview(): void {
    if (!this.gridEl || !this.hoverCell) return;
    if (!this.selected && this.movingIndex === null) return;

    let id: DecorationId | null = null;
    let w = 1;
    let h = 1;
    let ok = false;
    let at: CellPoint | null = null;
    let displayAt: CellPoint | null = null;

    if (this.movingIndex !== null) {
      const p = this.garden.listPlacements()[this.movingIndex];
      if (!p) return;
      id = p.id as DecorationId;
      w = p.w;
      h = p.h;
      at = topLeftFromHover(this.hoverCell, this.grabOffset);
      ok = this.garden.canMove(this.movingIndex, at.x, at.y);
      displayAt = clampTopLeftToGrid(at, { w, h }, { w: this.garden.width, h: this.garden.height });
    } else if (this.selected) {
      const def = DECORATIONS.find((d) => d.id === this.selected);
      if (!def) return;
      id = def.id;
      w = def.w;
      h = def.h;
      at = topLeftFromHover(this.hoverCell, this.grabOffset);
      ok = this.garden.canPlace(at.x, at.y, w, h);
      displayAt = clampTopLeftToGrid(at, { w, h }, { w: this.garden.width, h: this.garden.height });
    }

    const ghost = document.createElement("div");
    if (!displayAt) return;
    ghost.style.gridColumn = `${displayAt.x + 1} / span ${w}`;
    ghost.style.gridRow = `${displayAt.y + 1} / span ${h}`;
    ghost.style.borderRadius = "10px";
    ghost.style.border = ok ? "2px dashed rgba(255, 209, 102, 0.95)" : "2px dashed rgba(255, 99, 132, 0.9)";
    ghost.style.background = ok ? "rgba(255, 209, 102, 0.14)" : "rgba(255, 99, 132, 0.10)";
    ghost.style.pointerEvents = "none";
    ghost.style.display = "grid";
    ghost.style.placeItems = "center";
    ghost.style.color = "rgba(0,0,0,0.65)";
    ghost.style.fontSize = "12px";
    ghost.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ghost.textContent = id ? "预览" : "";
    this.gridEl.appendChild(ghost);
  }

  private renderLevels(): void {
    if (!this.levelListEl) return;
    const items = LEVELS.map((l) => {
      const unlocked = l.id === "T1" ? true : isLevelUnlocked(this.save, l.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.setAttribute("data-level-id", l.id);
      btn.disabled = !unlocked;
      btn.style.width = "100%";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "space-between";
      btn.style.gap = "8px";
      btn.style.margin = "6px 0";
      btn.style.opacity = unlocked ? "1" : "0.5";
      const left = document.createElement("span");
      left.textContent = `${l.id} · ${l.name}`;
      const right = document.createElement("code");
      right.textContent = unlocked ? "已解锁" : "未解锁";
      btn.appendChild(left);
      btn.appendChild(right);
      return btn;
    });

    this.levelListEl.innerHTML = "";
    for (const el of items) this.levelListEl.appendChild(el);
  }
}

function renderDecorationButton(def: DecorationDef, count: number, selected: boolean, disabled: boolean): HTMLElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn";
  btn.setAttribute("data-deco-id", def.id);
  btn.disabled = disabled;

  btn.style.width = "100%";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "space-between";
  btn.style.gap = "8px";
  btn.style.margin = "6px 0";
  btn.style.borderColor = selected ? "#ffd166" : "rgba(255,255,255,0.2)";
  btn.style.background = selected ? "rgba(255, 209, 102, 0.18)" : "rgba(255, 255, 255, 0.08)";
  btn.style.opacity = disabled ? "0.55" : "1";

  const left = document.createElement("span");
  left.style.display = "flex";
  left.style.alignItems = "center";
  left.style.gap = "8px";
  const icon = document.createElement("img");
  icon.alt = "";
  icon.src = stickerUrl(def.id);
  icon.style.width = "20px";
  icon.style.height = "20px";
  const text = document.createElement("span");
  text.textContent = `${def.name}（${def.w}×${def.h}）`;
  left.appendChild(icon);
  left.appendChild(text);
  const right = document.createElement("code");
  right.textContent = String(count);

  btn.appendChild(left);
  btn.appendChild(right);
  return btn;
}
