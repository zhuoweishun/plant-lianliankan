import { genBoard } from "../../core/board/boardGen.ts";
import type { Board } from "../../core/board/Board.ts";
import { canLink, type Point } from "../../core/board/linkPath.ts";
import { dropForMatch } from "../../core/drops/dropTable.ts";
import { Inventory, type InventoryJSON } from "../../core/inventory/Inventory.ts";
import { isGoalsCompleted } from "../../core/level/goals.ts";
import { getDecoration, type DecorationId } from "../../data/decorations.ts";
import { getLevel, type LevelId } from "../../data/levels.ts";

type MaterialId = DecorationId;

type Selected = Point & { materialId: MaterialId };

type MatchSceneOptions = {
  levelId: LevelId;
  onGoGarden?: (payload: { award: boolean; sessionInventory: InventoryJSON }) => void;
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

  private board: Board<MaterialId> | null = null;
  private inventory = new Inventory<MaterialId>();
  private selected: Selected | null = null;
  private state: "playing" | "won" = "playing";

  // Visual config
  private readonly cellSizeCssPx = 56;
  private readonly paddingCssPx = 12;

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
            <button type="button" class="btn" data-action="abandon" style="margin-left: 8px;">放弃回花园</button>
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
          <button type="button" class="btn" data-action="win-to-garden">回花园结算</button>
        </div>
      </div>
    `;

    const canvas = this.root.querySelector<HTMLCanvasElement>("canvas.board-canvas");
    const pre = this.root.querySelector<HTMLPreElement>("pre.hud-json");
    const goals = this.root.querySelector<HTMLDivElement>("div.hud-goals");
    const winOverlay = this.root.querySelector<HTMLDivElement>("div.win-overlay");
    if (!canvas || !pre || !goals || !winOverlay) {
      throw new Error("MatchScene mount failed: missing DOM nodes");
    }
    this.canvas = canvas;
    this.hudPre = pre;
    this.goalsEl = goals;
    this.winOverlayEl = winOverlay;

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
    this.board = null;
    this.selected = null;
  }

  private readonly onRootClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    const action = target?.getAttribute("data-action");
    if (action === "restart") this.restart();
    if (action === "abandon") this.options.onGoGarden?.({ award: false, sessionInventory: {} });
    if (action === "win-to-garden") this.options.onGoGarden?.({ award: true, sessionInventory: this.inventory.toJSON() });
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
      this.draw();
      return;
    }

    const picked: Selected = { x, y, materialId };

    if (!this.selected) {
      this.selected = picked;
      this.draw();
      return;
    }

    if (this.selected.x === picked.x && this.selected.y === picked.y) {
      this.selected = null;
      this.draw();
      return;
    }

    const a = this.selected;
    const b = picked;

    if (a.materialId !== b.materialId) {
      this.selected = picked;
      this.draw();
      return;
    }

    const linkable = canLink(this.board.grid, a, b);
    if (!linkable) {
      this.selected = picked;
      this.draw();
      return;
    }

    // Success: remove tiles + drop rewards
    this.board.grid[a.y]![a.x] = null;
    this.board.grid[b.y]![b.x] = null;
    this.selected = null;

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
    this.board = genBoard(this.level.size, {
      seed: `${this.level.id}-${Date.now()}`,
      materialIds: this.level.materialIds,
      requiredPairs: this.level.goals,
    });
    this.inventory = new Inventory<MaterialId>();
    this.selected = null;
    this.state = "playing";
    this.showWinOverlay(false);
    this.updateHud();
    this.resizeCanvasToBoard();
    this.draw();
  }

  private updateHud(): void {
    if (!this.hudPre) return;
    this.hudPre.textContent = JSON.stringify(this.inventory.toJSON(), null, 2);
    this.renderGoals();
  }

  private renderGoals(): void {
    if (!this.goalsEl) return;
    const inv = this.inventory.toJSON();
    const rows = Object.entries(this.level.goals)
      .filter(([, need]) => (need ?? 0) > 0)
      .map(([id, need]) => {
        const def = getDecoration(id as DecorationId);
        const have = inv[id] ?? 0;
        const ok = have >= (need ?? 0);
        return `
          <div style="display:flex; justify-content:space-between; gap:10px; margin:6px 0; padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background:${ok ? "rgba(6,214,160,0.10)" : "rgba(255,255,255,0.05)"};">
            <span>${def.name}</span>
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
        } else {
          ctx.fillStyle = colorFor(v);
        }
        ctx.fillRect(left + 1, top + 1, s - 2, s - 2);

        if (v !== null) {
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(shortLabel(v), left + s / 2, top + s / 2);
        }
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
  }
}

function shortLabel(id: MaterialId): string {
  const s = String(id);
  if (s.length <= 4) return s;
  return `${s.slice(0, 3)}…`;
}

function colorFor(id: MaterialId): string {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 70% 45%)`;
}
