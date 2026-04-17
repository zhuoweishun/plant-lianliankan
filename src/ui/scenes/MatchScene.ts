import { genBoard } from "../../core/board/boardGen.ts";
import type { Board } from "../../core/board/Board.ts";
import { canLink, type Point } from "../../core/board/linkPath.ts";
import { dropForMatch } from "../../core/drops/dropTable.ts";
import { Inventory, type InventoryJSON } from "../../core/inventory/Inventory.ts";
import { DECORATIONS, type DecorationId } from "../../data/decorations.ts";

type MaterialId = DecorationId;

type Selected = Point & { materialId: MaterialId };

type MatchSceneOptions = {
  onGoGarden?: (sessionInventory: InventoryJSON) => void;
};

export class MatchScene {
  private root: HTMLElement | null = null;
  private readonly options: MatchSceneOptions;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private hudPre: HTMLPreElement | null = null;

  private board: Board<MaterialId> | null = null;
  private inventory = new Inventory<MaterialId>();
  private selected: Selected | null = null;

  // Visual config
  private readonly cellSizeCssPx = 56;
  private readonly paddingCssPx = 12;

  // Game config (MVP)
  private readonly size = { width: 10, height: 8 };
  private readonly materialIds: readonly MaterialId[] = DECORATIONS.map((d) => d.id);

  constructor(options: MatchSceneOptions = {}) {
    this.options = options;
  }

  mount(root: HTMLElement): void {
    this.root = root;
    this.root.innerHTML = `
      <div class="app-shell">
        <main class="board-pane">
          <canvas class="board-canvas" aria-label="match board"></canvas>
        </main>
        <aside class="hud-pane">
          <h2>本局掉落（Inventory JSON）</h2>
          <pre class="hud-json" aria-label="inventory json"></pre>
          <div class="hud-actions">
            <button type="button" class="btn" data-action="restart">重新开局</button>
            <button type="button" class="btn" data-action="to-garden" style="margin-left: 8px;">回花园</button>
          </div>
          <p class="hud-hint">
            操作：依次点击两张同素材牌；若 <code>canLink</code> 为真则消除并掉落 1 个同素材。
          </p>
        </aside>
      </div>
    `;

    const canvas = this.root.querySelector<HTMLCanvasElement>("canvas.board-canvas");
    const pre = this.root.querySelector<HTMLPreElement>("pre.hud-json");
    if (!canvas || !pre) {
      throw new Error("MatchScene mount failed: missing DOM nodes");
    }
    this.canvas = canvas;
    this.hudPre = pre;

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
    this.board = null;
    this.selected = null;
  }

  private readonly onRootClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    const action = target?.getAttribute("data-action");
    if (action === "restart") this.restart();
    if (action === "to-garden") this.options.onGoGarden?.(this.inventory.toJSON());
  };

  private readonly onResize = (): void => {
    this.resizeCanvasToBoard();
    this.draw();
  };

  private readonly onCanvasClick = (e: MouseEvent): void => {
    if (!this.board || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    // Use CSS pixels; conversion to board cell coordinates uses CSS sizes.
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

    // First pick
    if (!this.selected) {
      this.selected = picked;
      this.draw();
      return;
    }

    // Clicking the same cell cancels selection
    if (this.selected.x === picked.x && this.selected.y === picked.y) {
      this.selected = null;
      this.draw();
      return;
    }

    const a = this.selected;
    const b = picked;

    // Second pick: validate match
    if (a.materialId !== b.materialId) {
      this.selected = picked; // allow quick retargeting
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
    this.draw();
  };

  private restart(): void {
    this.board = genBoard(this.size, {
      seed: `mvp-${Date.now()}`,
      materialIds: this.materialIds,
    });
    this.inventory = new Inventory<MaterialId>();
    this.selected = null;
    this.updateHud();
    this.resizeCanvasToBoard();
    this.draw();
  }

  private updateHud(): void {
    if (!this.hudPre) return;
    this.hudPre.textContent = JSON.stringify(this.inventory.toJSON(), null, 2);
  }

  private resizeCanvasToBoard(): void {
    if (!this.canvas || !this.board) return;

    const cssW = this.paddingCssPx * 2 + this.board.width * this.cellSizeCssPx;
    const cssH = this.paddingCssPx * 2 + this.board.height * this.cellSizeCssPx;

    // CSS size
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    // Backing store size (HiDPI aware)
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

    // Cells
    for (let y = 0; y < this.board.height; y++) {
      for (let x = 0; x < this.board.width; x++) {
        const left = pad + x * s;
        const top = pad + y * s;
        const v = this.board.get(x, y);

        // cell bg
        if (v === null) {
          ctx.fillStyle = "rgba(255,255,255,0.06)";
        } else {
          ctx.fillStyle = colorFor(v);
        }
        ctx.fillRect(left + 1, top + 1, s - 2, s - 2);

        // label
        if (v !== null) {
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(shortLabel(v), left + s / 2, top + s / 2);
        }
      }
    }

    // Grid lines
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

    // Selection highlight
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
  // Deterministic HSL from a tiny string hash.
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue} 70% 45%)`;
}
