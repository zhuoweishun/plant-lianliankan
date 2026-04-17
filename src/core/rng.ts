import type { Rng, Seed, UInt32 } from "./types.ts";

const UINT32_MAX_PLUS_1 = 0x1_0000_0000; // 2^32

function fnv1a32(str: string): UInt32 {
  // FNV-1a 32-bit hash (stable across runtimes)
  let h = 0x811c9dc5; // offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // h *= 16777619 (but keep it in uint32)
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function seedToUint32(seed: Seed): UInt32 {
  if (typeof seed === "number") {
    // Normalize to uint32. Note: NaN becomes 0; Infinity becomes 0.
    return (seed >>> 0) as UInt32;
  }
  return fnv1a32(seed);
}

/**
 * Create a deterministic RNG from a seed.
 *
 * Implementation: xorshift32 (George Marsaglia).
 * - Very small state (uint32) and fast.
 * - Not cryptographically secure.
 */
export function makeRng(seed: Seed): Rng {
  // xorshift32 gets stuck at 0 forever; ensure non-zero state.
  let state = seedToUint32(seed) >>> 0;
  if (state === 0) state = 0x6d2b79f5; // arbitrary non-zero constant

  const nextUint32 = (): UInt32 => {
    // xorshift32: https://www.jstatsoft.org/article/view/v008i14
    state ^= (state << 13) >>> 0;
    state ^= state >>> 17;
    state ^= (state << 5) >>> 0;
    state >>>= 0;
    return state as UInt32;
  };

  const nextFloat = (): number => {
    // Divide by 2^32 to map to [0, 1).
    return nextUint32() / UINT32_MAX_PLUS_1;
  };

  const int = (minInclusive: number, maxExclusive: number): number => {
    if (!Number.isFinite(minInclusive) || !Number.isFinite(maxExclusive)) {
      throw new Error("min/max must be finite numbers");
    }
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
      throw new Error("min/max must be integers");
    }
    if (maxExclusive <= minInclusive) {
      throw new Error("maxExclusive must be > minInclusive");
    }
    const span = maxExclusive - minInclusive;
    return minInclusive + Math.floor(nextFloat() * span);
  };

  return { nextUint32, nextFloat, int };
}

