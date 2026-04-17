import { describe, expect, it } from "vitest";
import { makeRng } from "../src/core/rng.ts";

describe("core/rng", () => {
  it("is deterministic for the same seed", () => {
    const a = makeRng(123);
    const b = makeRng(123);

    const seqA = Array.from({ length: 10 }, () => a.nextUint32());
    const seqB = Array.from({ length: 10 }, () => b.nextUint32());
    expect(seqA).toEqual(seqB);

    const floatsA = Array.from({ length: 10 }, () => a.nextFloat());
    const floatsB = Array.from({ length: 10 }, () => b.nextFloat());
    expect(floatsA).toEqual(floatsB);
  });

  it("differs for different seeds (very likely)", () => {
    const a = makeRng(123);
    const b = makeRng(124);
    const seqA = Array.from({ length: 5 }, () => a.nextUint32());
    const seqB = Array.from({ length: 5 }, () => b.nextUint32());
    expect(seqA).not.toEqual(seqB);
  });

  it("handles seed=0 without getting stuck", () => {
    const rng = makeRng(0);
    const seq = Array.from({ length: 5 }, () => rng.nextUint32());
    // xorshift32 with state 0 would produce all zeros; we must not.
    expect(seq.some((n) => n !== 0)).toBe(true);
  });

  it("nextFloat() stays in [0, 1)", () => {
    const rng = makeRng("float-range");
    for (let i = 0; i < 1000; i++) {
      const x = rng.nextFloat();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("int(min, maxExclusive) stays in range and is deterministic", () => {
    const a = makeRng("int-range");
    const b = makeRng("int-range");
    for (let i = 0; i < 200; i++) {
      const x = a.int(-2, 3);
      expect(x).toBeGreaterThanOrEqual(-2);
      expect(x).toBeLessThan(3);
      expect(x).toBe(b.int(-2, 3));
    }
  });

  it("int() rejects invalid ranges", () => {
    const rng = makeRng(1);
    expect(() => rng.int(0, 0)).toThrow();
    expect(() => rng.int(1, 0)).toThrow();
    expect(() => rng.int(0.5, 2)).toThrow();
    expect(() => rng.int(0, Number.POSITIVE_INFINITY)).toThrow();
  });
});

