/**
 * A number intended to represent an unsigned 32-bit integer (0..2^32-1).
 *
 * Note: JavaScript numbers are IEEE-754 doubles; always use bitwise ops
 * (e.g. >>> 0) when you need to force uint32 normalization.
 */
export type UInt32 = number;

/**
 * Seed accepted by {@link makeRng}. Strings are converted to a stable uint32.
 */
export type Seed = number | string;

/**
 * Deterministic pseudo random number generator.
 *
 * - `nextUint32()` returns a uint32 in [0, 2^32-1]
 * - `nextFloat()` returns a float in [0, 1)
 */
export interface Rng {
  nextUint32(): UInt32;
  nextFloat(): number;
  int(minInclusive: number, maxExclusive: number): number;
}

