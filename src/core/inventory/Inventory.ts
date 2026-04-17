export type InventoryJSON = Record<string, number>;

function assertNonNegativeSafeInteger(n: number, name: string): void {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
}

/**
 * Simple material inventory.
 *
 * - Keys are normalized to string internally (so number ids are supported too).
 * - Missing keys read as 0.
 */
export class Inventory<TMaterialId extends string | number = string> {
  private readonly counts = new Map<string, number>();

  private keyOf(id: TMaterialId): string {
    return String(id);
  }

  /**
   * Add amount for the given material id.
   * @returns the updated count.
   */
  add(materialId: TMaterialId, amount = 1): number {
    assertNonNegativeSafeInteger(amount, "amount");

    const key = this.keyOf(materialId);
    const prev = this.counts.get(key) ?? 0;
    const next = prev + amount;
    assertNonNegativeSafeInteger(next, "count");

    this.counts.set(key, next);
    return next;
  }

  get(materialId: TMaterialId): number {
    return this.counts.get(this.keyOf(materialId)) ?? 0;
  }

  toJSON(): InventoryJSON {
    const obj: InventoryJSON = {};
    for (const [k, v] of this.counts.entries()) {
      // JSON shouldn't carry negative values.
      assertNonNegativeSafeInteger(v, `count(${k})`);
      if (v !== 0) obj[k] = v;
    }
    return obj;
  }

  static fromJSON<TMaterialId extends string | number = string>(json: InventoryJSON): Inventory<TMaterialId> {
    if (json === null || typeof json !== "object" || Array.isArray(json)) {
      throw new Error("Inventory.fromJSON expects a plain object");
    }

    const inv = new Inventory<TMaterialId>();
    for (const [k, v] of Object.entries(json)) {
      if (typeof v !== "number") {
        throw new Error(`Inventory.fromJSON expects number values, got ${typeof v} for key ${k}`);
      }
      assertNonNegativeSafeInteger(v, `count(${k})`);
      if (v !== 0) inv.counts.set(k, v);
    }
    return inv;
  }
}

