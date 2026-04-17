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

/**
 * Find a concrete link path (<=2 turns) between a and b.
 *
 * Returns a polyline as a list of points (including endpoints). Points may go
 * outside the board by 1 cell (x=-1 or x=width, y=-1 or y=height) to represent
 * the classic "outside corridor" rule.
 *
 * If no path exists, returns null.
 */
export function findLinkPath<T>(
  grid: ReadonlyArray<ReadonlyArray<T | null | undefined>>,
  a: Point,
  b: Point,
): Point[] | null {
  const height = grid.length;
  const width = height === 0 ? 0 : grid[0]!.length;

  if (height === 0 || width === 0) return null;
  if (a.x === b.x && a.y === b.y) return null;
  if (!inBounds(width, height, a.x, a.y)) return null;
  if (!inBounds(width, height, b.x, b.y)) return null;

  const exW = width + 2;
  const exH = height + 2;

  const blocked: boolean[][] = Array.from({ length: exH }, () =>
    Array.from({ length: exW }, () => false),
  );

  for (let y = 0; y < height; y++) {
    const row = grid[y]!;
    for (let x = 0; x < width; x++) {
      const v = row[x];
      blocked[y + 1]![x + 1] = v !== null && v !== undefined;
    }
  }

  const ax = a.x + 1;
  const ay = a.y + 1;
  const bx = b.x + 1;
  const by = b.y + 1;

  blocked[ay]![ax] = false;
  blocked[by]![bx] = false;

  const INF = 1_000_000;
  const visited: number[][][] = Array.from({ length: exH }, () =>
    Array.from({ length: exW }, () => Array.from({ length: 5 }, () => INF)),
  );

  type State = { x: number; y: number; dir: number; turns: number };
  type Parent = { x: number; y: number; dir: number } | null;
  const parent: Parent[][][] = Array.from({ length: exH }, () =>
    Array.from({ length: exW }, () => Array.from({ length: 5 }, () => null)),
  );

  const q: State[] = [];
  const push = (from: State, to: State) => {
    if (to.turns > 2) return;
    if (to.turns >= visited[to.y]![to.x]![to.dir]!) return;
    visited[to.y]![to.x]![to.dir] = to.turns;
    parent[to.y]![to.x]![to.dir] = { x: from.x, y: from.y, dir: from.dir };
    q.push(to);
  };

  // Seed: start state with dir=4 and no parent.
  visited[ay]![ax]![4] = 0;
  q.push({ x: ax, y: ay, dir: 4, turns: 0 });

  const dirs = [
    { dx: 0, dy: -1 }, // up
    { dx: 1, dy: 0 }, // right
    { dx: 0, dy: 1 }, // down
    { dx: -1, dy: 0 }, // left
  ] as const;

  let end: { x: number; y: number; dir: number } | null = null;

  while (q.length > 0) {
    const cur = q.shift()!;
    if (cur.x === bx && cur.y === by) {
      end = { x: cur.x, y: cur.y, dir: cur.dir };
      break;
    }

    for (let ndir = 0; ndir < 4; ndir++) {
      const addTurn = cur.dir === 4 || cur.dir === ndir ? 0 : 1;
      const nturns = cur.turns + addTurn;
      if (nturns > 2) continue;

      const nx = cur.x + dirs[ndir]!.dx;
      const ny = cur.y + dirs[ndir]!.dy;
      if (nx < 0 || nx >= exW || ny < 0 || ny >= exH) continue;
      if (blocked[ny]![nx]!) continue;

      push(cur, { x: nx, y: ny, dir: ndir, turns: nturns });
    }
  }

  if (!end) return null;

  // Reconstruct expanded-grid path.
  const exPath: Array<{ x: number; y: number }> = [];
  let cur: { x: number; y: number; dir: number } | null = end;
  while (cur) {
    exPath.push({ x: cur.x, y: cur.y });
    const p: Parent = parent[cur.y]![cur.x]![cur.dir]!;
    cur = p;
  }
  // Add start state position (dir=4) explicitly.
  exPath.push({ x: ax, y: ay });
  exPath.reverse();

  // Convert to "corridor coords" (original board coords with -1..width range).
  const path: Point[] = exPath.map((p) => ({ x: p.x - 1, y: p.y - 1 }));

  // Compress to corner points (polyline).
  if (path.length <= 2) return path;
  const out: Point[] = [path[0]!];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1]!;
    const curP = path[i]!;
    const next = path[i + 1]!;
    const dx1 = curP.x - prev.x;
    const dy1 = curP.y - prev.y;
    const dx2 = next.x - curP.x;
    const dy2 = next.y - curP.y;
    if (dx1 === dx2 && dy1 === dy2) continue;
    out.push(curP);
  }
  out.push(path[path.length - 1]!);
  return out;
}

function inBounds(width: number, height: number, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < width && y >= 0 && y < height;
}
