import { genBoard } from "../../core/board/boardGen.ts";
import type { Board } from "../../core/board/Board.ts";
import { canLink, findLinkPath, type Point } from "../../core/board/linkPath.ts";
import { dropForMatch } from "../../core/drops/dropTable.ts";
import { Inventory, type InventoryJSON } from "../../core/inventory/Inventory.ts";
import { isGoalsCompleted } from "../../core/level/goals.ts";
import { hasAnyLinkablePair, reshuffleGrid } from "../../core/board/reshuffle.ts";
import { findAnyLinkablePair } from "../../core/board/hint.ts";
import { getMaterialName, type MaterialId } from "../../data/materials.ts";
import { getLevel, getNextLevelId, type LevelId } from "../../data/levels.ts";
import { formatMaterialDelta } from "../victorySummary.ts";
import { getStickerImage, preloadStickers } from "../stickers.ts";

type Selected = Point & { materialId: MaterialId };

type MatchSceneOptions = {
  levelId: LevelId;
  onGoGarden?: (payload: { award: boolean; sessionInventory: InventoryJSON; focusCrafting?: boolean }) => void;
  onGoNextLevel?: (payload: { nextLevelId: LevelId; sessionInventory: InventoryJSON }) => void;
};

export class MatchScene {
  private root: HTMLElement | null = null;
  private readonly options: MatchSceneOptions;
  private readonly level: ReturnType<typeof getLevel>;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private hudPre: HTMLPreElement | null = null;
  private goalsEl: HTMLDivElement | null = null;
  private winOverlayEl: HTMLDivElement | null = null;
  private reshuffleBtn: HTMLButtonElement | null = null;
  private hintBtn: HTMLButtonElement | null = null;
  private noMovesHintEl: HTMLDivElement | null = null;

  private board: Board<MaterialId> | null = null;
  private inventory = new Inventory<MaterialId>();
  private selected: Selected | null = null;
  private state: "playing" | "won" = "playing";
  private hintPair: { a: Point; b: Point; start: number; until: number; path: Point[] } | null = null;

  // Visual config
  private readonly cellSizeCssPx = 56;
  // Make room for the classic "outside corridor" path rendering.
  private readonly paddingCssPx = 32;

  constructor(options: MatchSceneOptions) {
    this.options = options;
    this.level = getLevel(options.levelId);
  }

  mount(root: HTMLElement): void {
    this.root = root;
    this.root.innerHTML = `
      <div class="app-shell">
        <main class="board-pane">
          <canvas class="board-canvas" aria-label="match board"></canvas>
        </main>
        <aside class="hud-pane">
          <h2>${this.level.name}</h2>
          <div class="hud-goals" aria-label="level goals"></div>

          <h2 style="margin-top: 12px;">本局掉落（Debug JSON）</h2>
          <pre class="hud-json" aria-label="inventory json"></pre>

          <div class="hud-actions">
            <button type="button" class="btn" data-action="restart">重新开局</button>
            <button type="button" class="btn" data-action="hint" style="margin-left: 8px;" disabled>提示</button>
            <button type="button" class="btn" data-action="reshuffle" style="margin-left: 8px;" disabled>重洗牌</button>
            <button type="button" class="btn" data-action="abandon" style="margin-left: 8px;">放弃回花园</button>
          </div>
          <div class="no-moves-hint" style="margin-top:10px; display:none; font-size:12px; color: rgba(255, 209, 102, 0.9);">
            当前无可消对，建议点击“重洗牌”。
          </div>
          <p class="hud-hint">
            目标关卡：消除一对素材＝收集该素材 +1。<br />
            只有胜利才会结算进背包。
          </p>
        </aside>
      </div>

      <div class="win-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); padding:16px;">
        <div style="max-width:520px; margin: 10vh auto 0; background: rgba(18,26,22,0.96); border:1px solid rgba(255,255,255,0.14); border-radius:14px; padding:16px;">
          <h2 style="margin:0 0 10px;">胜利！</h2>
          <p style="margin:0 0 12px; color: rgba(255,255,255,0.75); font-size: 13px;">
            本关目标已完成。点击下方按钮回花园结算。
          </p>
          <div class="win-summary" style="margin: 10px 0 12px;"></div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button type="button" class="btn" data-action="win-to-garden">回花园结算</button>
            <button type="button" class="btn" data-action="win-to-craft">去工作台合成</button>
            <button type="button" class="btn" data-action="next-level">下一关</button>
          </div>
        </div>
      </div>
    `;

    const canvas = this.root.querySelector<HTMLCanvasElement>("canvas.board-canvas");
    const pre = this.root.querySelector<HTMLPreElement>("pre.hud-json");
    const goals = this.root.querySelector<HTMLDivElement>("div.hud-goals");
    const winOverlay = this.root.querySelector<HTMLDivElement>("div.win-overlay");
    const reshuffleBtn = this.root.querySelector<HTMLButtonElement>('button[data-action="reshuffle"]');
    const hintBtn = this.root.querySelector<HTMLButtonElement>('button[data-action="hint"]');
    const noMovesHint = this.root.querySelector<HTMLDivElement>("div.no-moves-hint");
    if (!canvas || !pre || !goals || !winOverlay || !reshuffleBtn || !hintBtn || !noMovesHint) {
      throw new Error("MatchScene mount failed: missing DOM nodes");
    }
    this.canvas = canvas;
    this.hudPre = pre;
    this.goalsEl = goals;
    this.winOverlayEl = winOverlay;
    this.reshuffleBtn = reshuffleBtn;
    this.hintBtn = hintBtn;
    this.noMovesHintEl = noMovesHint;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available");
    this.ctx = ctx;

    this.root.addEventListener("click", this.onRootClick);
    this.canvas.addEventListener("click", this.onCanvasClick);
    window.addEventListener("resize", this.onResize);

    this.restart();
  }

  unmount(): void {
    if (!this.root) return;
    this.root.removeEventListener("click", this.onRootClick);
    this.canvas?.removeEventListener("click", this.onCanvasClick);
    window.removeEventListener("resize", this.onResize);
    this.root.innerHTML = "";
    this.root = null;
    this.canvas = null;
    this.ctx = null;
    this.hudPre = null;
    this.goalsEl = null;
    this.winOverlayEl = null;
    this.reshuffleBtn = null;
    this.hintBtn = null;
    this.noMovesHintEl = null;
    this.board = null;
    this.selected = null;
    this.hintPair = null;
  }

  private readonly onRootClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    const action = target?.getAttribute("data-action");
    if (action === "restart") this.restart();
    if (action === "hint") this.showHint();
    if (action === "reshuffle") this.tryReshuffle();
    if (action === "abandon") this.options.onGoGarden?.({ award: false, sessionInventory: {} });
    if (action === "win-to-garden") this.options.onGoGarden?.({ award: true, sessionInventory: this.inventory.toJSON() });
    if (action === "win-to-craft") {
      this.options.onGoGarden?.({ award: true, sessionInventory: this.inventory.toJSON(), focusCrafting: true });
    }
    if (action === "next-level") {
      const next = getNextLevelId(this.level.id);
      if (!next) return;
      this.options.onGoNextLevel?.({ nextLevelId: next, sessionInventory: this.inventory.toJSON() });
    }
  };

  private readonly onResize = (): void => {
    this.resizeCanvasToBoard();
    this.draw();
  };

  private readonly onCanvasClick = (e: MouseEvent): void => {
    if (this.state !== "playing") return;
    if (!this.board || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;

    const x = Math.floor((xCss - this.paddingCssPx) / this.cellSizeCssPx);
    const y = Math.floor((yCss - this.paddingCssPx) / this.cellSizeCssPx);
    if (x < 0 || y < 0 || x >= this.board.width || y >= this.board.height) return;

    const materialId = this.board.get(x, y);
    if (materialId === null) {
      this.selected = null;
      this.hintPair = null;
      this.draw();
      return;
    }

    const picked: Selected = { x, y, materialId };

    if (!this.selected) {
      this.selected = picked;
      this.hintPair = null;
      this.draw();
      return;
    }

    if (this.selected.x === picked.x && this.selected.y === picked.y) {
      this.selected = null;
      this.hintPair = null;
      this.draw();
      return;
    }

    const a = this.selected;
    const b = picked;

    if (a.materialId !== b.materialId) {
      this.selected = picked;
      this.hintPair = null;
      this.draw();
      return;
    }

    const linkable = canLink(this.board.grid, a, b);
    if (!linkable) {
      this.selected = picked;
      this.hintPair = null;
      this.draw();
      return;
    }

    // Success: remove tiles + drop rewards
    this.board.grid[a.y]![a.x] = null;
    this.board.grid[b.y]![b.x] = null;
    this.selected = null;
    this.hintPair = null;

    for (const drop of dropForMatch(a.materialId)) {
      this.inventory.add(drop.materialId, drop.amount);
    }
    this.updateHud();

    if (isGoalsCompleted(this.level.goals, this.inventory.toJSON())) {
      this.state = "won";
      this.showWinOverlay(true);
    }

    this.draw();
  };

  private restart(): void {
    // Ensure level goals are actually achievable:
    // one match => +1 material, so the board must contain at least `goal` pairs for that material.
    // We use boardGen.requiredPairs to force those pairs when capacity allows.
    const pairsCapacity = (this.level.size.width * this.level.size.height) / 2;
    const requiredTotal = Object.values(this.level.goals).reduce((acc, v) => acc + (v ?? 0), 0);
    const canForce = Number.isFinite(pairsCapacity) && requiredTotal <= pairsCapacity;

    this.board = genBoard(this.level.size, {
      seed: `${this.level.id}-${Date.now()}`,
      materialIds: this.level.materialIds,
      ...(canForce ? { requiredPairs: this.level.goals } : {}),
    });
    this.inventory = new Inventory<MaterialId>();
    this.selected = null;
    this.hintPair = null;
    this.state = "playing";
    this.showWinOverlay(false);
    this.updateHud();
    this.resizeCanvasToBoard();
    this.draw();
    void preloadStickers(["wood", "stone", "water", "leaf"]);
  }

  private updateHud(): void {
    if (!this.hudPre) return;
    this.hudPre.textContent = JSON.stringify(this.inventory.toJSON(), null, 2);
    this.renderGoals();
    this.updateNoMovesUi();
  }

  private updateNoMovesUi(): void {
    if (!this.board || !this.reshuffleBtn || !this.hintBtn || !this.noMovesHintEl) return;
    if (this.state !== "playing") {
      this.reshuffleBtn.disabled = true;
      this.hintBtn.disabled = true;
      this.noMovesHintEl.style.display = "none";
      return;
    }
    const noMoves = !hasAnyLinkablePair(this.board.grid);
    // Keep enabled even when there are moves (useful for testing, and avoids "I clicked nothing happened" confusion).
    this.reshuffleBtn.disabled = false;
    this.hintBtn.disabled = noMoves;
    this.noMovesHintEl.style.display = noMoves ? "block" : "none";
  }

  private showHint(): void {
    if (!this.board) return;
    if (this.state !== "playing") return;
    const pair = findAnyLinkablePair(this.board.grid);
    if (!pair) return;
    const start = Date.now();
    const until = start + 1500;
    const path = findLinkPath(this.board.grid, pair.a, pair.b) ?? [pair.a, pair.b];
    this.hintPair = { a: pair.a, b: pair.b, start, until, path };

    const tick = () => {
      if (!this.hintPair) return;
      if (this.hintPair.until !== until) return;
      const now = Date.now();
      if (now >= until) {
        this.hintPair = null;
        this.draw();
        return;
      }
      this.draw();
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }

  private tryReshuffle(): void {
    if (!this.board) return;
    if (this.state !== "playing") return;
    const out = reshuffleGrid(this.board.grid, { seed: `${this.level.id}-${Date.now()}`, maxTries: 300 });
    if (!out) return;
    this.board.grid.splice(0, this.board.grid.length, ...out);
    this.selected = null;
    this.hintPair = null;
    this.updateHud();
    this.draw();
  }

  private renderGoals(): void {
    if (!this.goalsEl) return;
    const inv = this.inventory.toJSON();
    const rows = Object.entries(this.level.goals)
      .filter(([, need]) => (need ?? 0) > 0)
      .map(([id, need]) => {
        const name = getMaterialName(id as MaterialId);
        const have = inv[id] ?? 0;
        const ok = have >= (need ?? 0);
        return `
          <div style="display:flex; justify-content:space-between; gap:10px; margin:6px 0; padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background:${ok ? "rgba(6,214,160,0.10)" : "rgba(255,255,255,0.05)"};">
            <span>${name}</span>
            <code>${have}/${need}</code>
          </div>
        `;
      })
      .join("");

    this.goalsEl.innerHTML = `
      <div style="font-size:12px; color: rgba(255,255,255,0.75); margin-bottom:6px;">收集目标：</div>
      ${rows || `<div style="font-size:12px; color: rgba(255,255,255,0.7);">（本关没有目标）</div>`}
    `;
  }

  private showWinOverlay(show: boolean): void {
    if (!this.winOverlayEl) return;
    this.winOverlayEl.style.display = show ? "block" : "none";

    // If this is the last level, hide "下一关" button.
    const nextBtn = this.winOverlayEl.querySelector<HTMLButtonElement>('button[data-action="next-level"]');
    if (nextBtn) nextBtn.style.display = getNextLevelId(this.level.id) ? "inline-flex" : "none";

    if (show) this.renderWinSummary();
  }

  private renderWinSummary(): void {
    if (!this.winOverlayEl) return;
    const el = this.winOverlayEl.querySelector<HTMLDivElement>("div.win-summary");
    if (!el) return;
    const rows = formatMaterialDelta(this.inventory.toJSON());
    if (rows.length === 0) {
      el.innerHTML = `<div style="font-size:12px; color: rgba(255,255,255,0.65);">（本局没有获得材料）</div>`;
      return;
    }
    el.innerHTML = `
      <div style="font-size:12px; color: rgba(255,255,255,0.75); margin-bottom:6px;">本局获得：</div>
      ${rows
        .map(
          (r) => `
            <div style="display:flex; justify-content:space-between; gap:10px; margin:6px 0; padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.22);">
              <span>${r.name}</span>
              <code>+${r.amount}</code>
            </div>
          `,
        )
        .join("")}
    `;
  }

  private resizeCanvasToBoard(): void {
    if (!this.canvas || !this.board) return;

    const cssW = this.paddingCssPx * 2 + this.board.width * this.cellSizeCssPx;
    const cssH = this.paddingCssPx * 2 + this.board.height * this.cellSizeCssPx;

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);

    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private draw(): void {
    if (!this.ctx || !this.canvas || !this.board) return;
    const ctx = this.ctx;

    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, w, h);

    const pad = this.paddingCssPx;
    const s = this.cellSizeCssPx;

    for (let y = 0; y < this.board.height; y++) {
      for (let x = 0; x < this.board.width; x++) {
        const left = pad + x * s;
        const top = pad + y * s;
        const v = this.board.get(x, y);

        if (v === null) {
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(left + 1, top + 1, s - 2, s - 2);
          continue;
        }

        // Cell base (subtle) + sticker icon
        ctx.fillStyle = "rgba(0,0,0,0.10)";
        ctx.fillRect(left + 1, top + 1, s - 2, s - 2);
        drawStickerInCell(ctx, v, left, top, s);
      }
    }

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.board.width; x++) {
      const xx = pad + x * s;
      ctx.moveTo(xx, pad);
      ctx.lineTo(xx, pad + this.board.height * s);
    }
    for (let y = 0; y <= this.board.height; y++) {
      const yy = pad + y * s;
      ctx.moveTo(pad, yy);
      ctx.lineTo(pad + this.board.width * s, yy);
    }
    ctx.stroke();

    if (this.selected) {
      const left = pad + this.selected.x * s;
      const top = pad + this.selected.y * s;
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 3;
      ctx.strokeRect(left + 2, top + 2, s - 4, s - 4);
    }

    // Hint line animation + highlight
    if (this.hintPair && Date.now() < this.hintPair.until) {
      const now = Date.now();
      const t = now - this.hintPair.start;
      const drawProgress = Math.min(1, t / 500); // draw in first 0.5s then hold
      const blink = Math.floor(now / 200) % 2;

      // Draw path polyline (animated)
      const toCanvas = (p: Point) => ({
        x: pad + (p.x + 0.5) * s,
        y: pad + (p.y + 0.5) * s,
      });

      const pts = this.hintPair.path.map(toCanvas);
      if (pts.length >= 2) {
        let total = 0;
        const segLen: number[] = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const dx = pts[i + 1]!.x - pts[i]!.x;
          const dy = pts[i + 1]!.y - pts[i]!.y;
          const len = Math.hypot(dx, dy);
          segLen.push(len);
          total += len;
        }

        const target = total * drawProgress;
        let acc = 0;

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = blink === 0 ? "rgba(6,214,160,0.95)" : "rgba(6,214,160,0.35)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pts[0]!.y);

        for (let i = 0; i < segLen.length; i++) {
          const p0 = pts[i]!;
          const p1 = pts[i + 1]!;
          const len = segLen[i]!;
          if (acc + len <= target) {
            ctx.lineTo(p1.x, p1.y);
            acc += len;
            continue;
          }
          const remain = target - acc;
          const r = len <= 0 ? 0 : Math.max(0, Math.min(1, remain / len));
          const x = p0.x + (p1.x - p0.x) * r;
          const y = p0.y + (p1.y - p0.y) * r;
          ctx.lineTo(x, y);
          break;
        }
        ctx.stroke();
        ctx.restore();
      }

      // Highlight the two hint tiles
      ctx.strokeStyle = blink === 0 ? "rgba(6,214,160,0.95)" : "rgba(6,214,160,0.25)";
      ctx.lineWidth = 4;
      for (const p of [this.hintPair.a, this.hintPair.b]) {
        const left = pad + p.x * s;
        const top = pad + p.y * s;
        ctx.strokeRect(left + 3, top + 3, s - 6, s - 6);
      }
    }

  }
}

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
  materialId: MaterialId,
  left: number,
  top: number,
  size: number,
) {
  // Card background
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

  const pad = 8;
  const iconSize = size - pad * 2;
  ctx.drawImage(img, left + pad, top + pad, iconSize, iconSize);
}
