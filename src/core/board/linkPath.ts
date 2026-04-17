export type Point = { x: number; y: number };

/**
 * Classic "连连看" connectivity check: whether two positions can be connected by
 * an orthogonal path with at most 2 turns (i.e. <= 3 straight segments).
 *
 * Rules implemented here:
 * - Only horizontal/vertical moves.
 * - Path may travel outside the board boundary (the outside "corridor" is empty).
 * - All intermediate cells on the path must be empty.
 * - The start/end cells are always allowed (even if occupied).
 *
 * `grid` is treated as a 2D matrix where non-null/undefined values are blockers.
 */
export function canLink<T>(
  grid: ReadonlyArray<ReadonlyArray<T | null | undefined>>,
  a: Point,
  b: Point,
): boolean {
  const height = grid.length;
  const width = height === 0 ? 0 : grid[0]!.length;

  if (height === 0 || width === 0) return false;
  if (a.x === b.x && a.y === b.y) return false;
  if (!inBounds(width, height, a.x, a.y)) return false;
  if (!inBounds(width, height, b.x, b.y)) return false;

  // Expand with a 1-cell empty border to model "corridor outside the board".
  // Coordinates shift by +1.
  const exW = width + 2;
  const exH = height + 2;

  const blocked: boolean[][] = Array.from({ length: exH }, () =>
    Array.from({ length: exW }, () => false),
  );

  // Copy blockers from original grid into expanded grid.
  for (let y = 0; y < height; y++) {
    const row = grid[y]!;
    for (let x = 0; x < width; x++) {
      const v = row[x];
      // corridor border remains empty; only inside [1..height]x[1..width] can block.
      blocked[y + 1]![x + 1] = v !== null && v !== undefined;
    }
  }

  const ax = a.x + 1;
  const ay = a.y + 1;
  const bx = b.x + 1;
  const by = b.y + 1;

  // Start/end are passable even if occupied.
  blocked[ay]![ax] = false;
  blocked[by]![bx] = false;

  // BFS with state = (x, y, direction), carrying minimal turns used to reach it.
  // direction: 0=up,1=right,2=down,3=left, 4=start(no direction yet)
  const INF = 1_000_000;
  const visited: number[][][] = Array.from({ length: exH }, () =>
    Array.from({ length: exW }, () => Array.from({ length: 5 }, () => INF)),
  );

  type State = { x: number; y: number; dir: number; turns: number };
  const q: State[] = [];
  const push = (s: State) => {
    if (s.turns > 2) return;
    if (s.turns >= visited[s.y]![s.x]![s.dir]!) return;
    visited[s.y]![s.x]![s.dir] = s.turns;
    q.push(s);
  };

  push({ x: ax, y: ay, dir: 4, turns: 0 });

  const dirs = [
    { dx: 0, dy: -1 }, // up
    { dx: 1, dy: 0 }, // right
    { dx: 0, dy: 1 }, // down
    { dx: -1, dy: 0 }, // left
  ] as const;

  while (q.length > 0) {
    const cur = q.shift()!;
    if (cur.x === bx && cur.y === by) return true;

    for (let ndir = 0; ndir < 4; ndir++) {
      const addTurn = cur.dir === 4 || cur.dir === ndir ? 0 : 1;
      const nturns = cur.turns + addTurn;
      if (nturns > 2) continue;

      const nx = cur.x + dirs[ndir]!.dx;
      const ny = cur.y + dirs[ndir]!.dy;
      if (nx < 0 || nx >= exW || ny < 0 || ny >= exH) continue;

      if (blocked[ny]![nx]!) continue;

      push({ x: nx, y: ny, dir: ndir, turns: nturns });
    }
  }

  return false;
}

function inBounds(width: number, height: number, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < width && y >= 0 && y < height;
}

