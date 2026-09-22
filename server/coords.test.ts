import { describe, expect, it } from 'vitest';
import {
  MAX_POSITION,
  MIN_POSITION,
  TMAX_RANGE,
  drawCoordinates,
  drawTmax,
  randomInt,
} from './coords.ts';

/** An rng that replays a fixed list of [0,1) values, then throws. */
function seq(values: number[]) {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('rng exhausted');
    return values[i++]!;
  };
}

describe('coords', () => {
  it('randomInt is inclusive at both ends', () => {
    expect(randomInt(seq([0]), 4, 12)).toBe(4);
    expect(randomInt(seq([0.999999]), 4, 12)).toBe(12);
  });

  it('draws a position in 4..12', () => {
    for (let i = 0; i < 50; i++) {
      const { galaxy, system, position } = drawCoordinates(Math.random, 9, 499);
      expect(position).toBeGreaterThanOrEqual(MIN_POSITION);
      expect(position).toBeLessThanOrEqual(MAX_POSITION);
      expect(galaxy).toBeGreaterThanOrEqual(1);
      expect(galaxy).toBeLessThanOrEqual(9);
      expect(system).toBeGreaterThanOrEqual(1);
      expect(system).toBeLessThanOrEqual(499);
    }
  });

  it('draws Tmax within the position range', () => {
    for (const [pos, [lo, hi]] of Object.entries(TMAX_RANGE)) {
      const tmax = drawTmax(Math.random, Number(pos));
      expect(tmax).toBeGreaterThanOrEqual(lo);
      expect(tmax).toBeLessThanOrEqual(hi);
      expect(Number.isInteger(tmax)).toBe(true);
    }
  });
});
