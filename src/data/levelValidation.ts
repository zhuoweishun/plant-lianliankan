import { MATERIALS } from "./materials.ts";
import type { LevelDef, LevelGateDef, LevelId, LevelLockDef, Point } from "./levels.ts";

export type LevelValidationResult = {
  levelId: LevelId;
  ok: boolean;
  errors: string[];
};

const KNOWN_MATERIAL_IDS = new Set(MATERIALS.map((material) => material.id));

function key(p: Point): string {
  return `${p.x},${p.y}`;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function inBounds(size: LevelDef["size"], p: Point): boolean {
  return Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < size.width && p.y < size.height;
}

function pushDupErrors(label: string, points: readonly Point[], errors: string[]): void {
  const seen = new Set<string>();
  for (const p of points) {
    const k = key(p);
    if (seen.has(k)) errors.push(`${label} 存在重复坐标: ${k}`);
    seen.add(k);
  }
}

function validatePoints(label: string, size: LevelDef["size"], points: readonly Point[], errors: string[]): void {
  for (const p of points) {
    if (!inBounds(size, p)) errors.push(`${label} 越界: ${key(p)}`);
  }
  pushDupErrors(label, points, errors);
}

function flattenGateCells(gates: readonly LevelGateDef[] | undefined): Point[] {
  return (gates ?? []).flatMap((g) => g.cells);
}

function flattenLockCells(locks: readonly LevelLockDef[] | undefined): Point[] {
  return (locks ?? []).flatMap((lk) => lk.cells);
}

function validateGates(level: LevelDef, errors: string[]): void {
  for (const gate of level.gates ?? []) {
    validatePoints("gate.cells", level.size, gate.cells, errors);
    if (gate.initial !== "open" && gate.initial !== "closed") errors.push("gate.initial 必须是 open 或 closed");
    if (gate.toggle !== "afterMatch") errors.push("gate.toggle 必须是 afterMatch");
    if (gate.group && gate.group !== "A" && gate.group !== "B") errors.push("gate.group 只能是 A 或 B");
  }
  pushDupErrors("gates", flattenGateCells(level.gates), errors);
}

function validateLocks(level: LevelDef, errors: string[]): void {
  for (const lock of level.locks ?? []) {
    validatePoints("lock.cells", level.size, lock.cells, errors);
    if (lock.hits !== 2) errors.push("lock.hits 必须固定为 2");
  }
  pushDupErrors("locks", flattenLockCells(level.locks), errors);
}

function validateMechanicPresence(level: LevelDef, errors: string[]): void {
  const chapter = level.chapter;
  const hasBlocked = (level.blocked?.length ?? 0) > 0;
  const hasGates = (level.gates?.length ?? 0) > 0;
  const hasLocks = (level.locks?.length ?? 0) > 0;
  const hasShift = level.shift !== undefined;

  if (level.kind !== "main") return;

  if (chapter === 1 && (hasBlocked || hasGates || hasLocks || hasShift)) errors.push("L1-L10 只能是基础递进关卡，不应提前挂载机制");
  if (chapter === 2) {
    if (!hasBlocked) errors.push("L11-L20 必须引入 blocked");
    if (hasGates || hasLocks || hasShift) errors.push("L11-L20 不应提前启用 gates/locks/shift");
  }
  if (chapter === 3) {
    if (!hasBlocked || !hasGates) errors.push("L21-L30 必须同时具备 blocked 和 gates");
    if (hasLocks || hasShift) errors.push("L21-L30 不应提前启用 locks/shift");
  }
  if (chapter === 4) {
    if (!hasBlocked || !hasGates || !hasLocks) errors.push("L31-L40 必须具备 blocked/gates/locks");
    if (hasShift) errors.push("L31-L40 不应提前启用 shift");
  }
  if (chapter === 5 && (!hasBlocked || !hasGates || !hasLocks || !hasShift)) {
    errors.push("L41-L50 必须具备 blocked/gates/locks/shift");
  }
}

export function validateLevel(level: LevelDef): LevelValidationResult {
  const errors: string[] = [];

  if (level.kind === "main") {
    if (!Number.isInteger(level.order) || level.order < 1 || level.order > 50) errors.push("main 关卡的 order 必须是 1..50 的整数");
    if (level.id !== `L${level.order}`) errors.push("main 关卡的 id 必须与 order 对齐");
    const expectedChapter = Math.ceil(level.order / 10);
    if (level.chapter !== expectedChapter) errors.push(`chapter 应与主线 order 对齐（期望 ${expectedChapter}）`);
  } else {
    if (level.order !== 0) errors.push("test 关卡的 order 必须为 0");
    if (level.chapter !== 0) errors.push("test 关卡的 chapter 必须为 0");
  }

  if (![1, 2, 3, 4, 5].includes(level.difficulty)) errors.push("difficulty 必须是 1..5");
  if (!isNonEmptyString(level.name)) errors.push("name 不能为空");
  if (!isPositiveInteger(level.size.width) || !isPositiveInteger(level.size.height)) errors.push("棋盘尺寸必须是正整数");

  if (level.materialIds.length === 0) errors.push("materialIds 不能为空");
  const uniqueMaterialIds = new Set(level.materialIds);
  if (uniqueMaterialIds.size !== level.materialIds.length) errors.push("materialIds 不能包含重复项");
  for (const materialId of level.materialIds) {
    if (!KNOWN_MATERIAL_IDS.has(materialId)) errors.push(`materialIds 包含未知材料: ${String(materialId)}`);
  }

  let goalTotal = 0;
  for (const [materialId, rawAmount] of Object.entries(level.goals)) {
    const amount = rawAmount ?? 0;
    if (!KNOWN_MATERIAL_IDS.has(materialId as (typeof MATERIALS)[number]["id"])) {
      errors.push(`goals 包含未知材料: ${materialId}`);
      continue;
    }
    if (!uniqueMaterialIds.has(materialId as LevelDef["materialIds"][number])) errors.push(`goals 中的材料必须出现在 materialIds 中: ${materialId}`);
    if (!Number.isInteger(amount) || amount <= 0) {
      errors.push(`goals(${materialId}) 必须是正整数`);
      continue;
    }
    goalTotal += amount;
  }

  const blocked = level.blocked ?? [];
  validatePoints("blocked", level.size, blocked, errors);
  const gateCells = flattenGateCells(level.gates);
  validateGates(level, errors);
  validateLocks(level, errors);

  const blockedSet = new Set(blocked.map(key));
  const gateSet = new Set(gateCells.map(key));
  const lockCells = flattenLockCells(level.locks);
  for (const p of gateCells) if (blockedSet.has(key(p))) errors.push(`gate 与 blocked 冲突: ${key(p)}`);
  for (const p of lockCells) {
    const k = key(p);
    if (blockedSet.has(k)) errors.push(`lock 与 blocked 冲突: ${k}`);
    if (gateSet.has(k)) errors.push(`lock 与 gate 冲突: ${k}`);
  }

  if (level.shift) {
    if (level.shift.afterMatch !== "row-random" && level.shift.afterMatch !== "rowcol-random") errors.push("shift.afterMatch 必须是 row-random 或 rowcol-random");
    if (level.shift.step !== 1 && level.shift.step !== 2) errors.push("shift.step 必须是 1 或 2");
    if (level.shift.blockedStatic !== true) errors.push("shift.blockedStatic 必须是 true");
  }

  if (level.notes !== undefined && !isNonEmptyString(level.notes)) errors.push("notes 若存在，必须是非空字符串");

  const totalCells = level.size.width * level.size.height;
  const availableCells = totalCells - blockedSet.size - gateSet.size;
  if (availableCells <= 0) {
    errors.push(`可放 tile 的格子数必须 > 0（当前 ${availableCells}）`);
  } else {
    if (availableCells % 2 !== 0) errors.push(`可放 tile 的格子数必须为偶数（当前 ${availableCells}）`);
    const capacityPairs = Math.floor(availableCells / 2);
    if (goalTotal > capacityPairs) errors.push(`目标总数不能超过棋盘容量上限（${goalTotal} > ${capacityPairs}）`);
  }

  validateMechanicPresence(level, errors);

  return { levelId: level.id, ok: errors.length === 0, errors };
}

export function validateLevels(levels: readonly LevelDef[]): LevelValidationResult[] {
  const results = levels.map((level) => validateLevel(level));
  const resultById = new Map<LevelId, LevelValidationResult>(results.map((result) => [result.levelId, result]));
  const idCounts = new Map<LevelId, number>();
  const orderCounts = new Map<number, number>();

  for (const level of levels) {
    idCounts.set(level.id, (idCounts.get(level.id) ?? 0) + 1);
    if (level.kind === "main") orderCounts.set(level.order, (orderCounts.get(level.order) ?? 0) + 1);
  }

  for (const [levelId, count] of idCounts) {
    if (count > 1) resultById.get(levelId)?.errors.push(`关卡 id 重复: ${levelId}`);
  }
  for (const [order, count] of orderCounts) {
    if (count > 1) resultById.get(`L${order}` as LevelId)?.errors.push(`主线关卡 order 重复: ${order}`);
  }

  const mainOrders = levels.filter((level) => level.kind === "main").map((level) => level.order).sort((a, b) => a - b);
  mainOrders.forEach((order, index) => {
    const expectedOrder = index + 1;
    if (order !== expectedOrder) resultById.get(`L${order}` as LevelId)?.errors.push(`主线关卡 order 必须连续，缺少 L${expectedOrder}`);
  });

  return results.map((result) => ({ ...result, ok: result.errors.length === 0 }));
}
