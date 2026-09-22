import { describe, expect, it } from 'vitest';
import { generateStars, STAR_COUNT } from './starField.ts';

describe('generateStars', () => {
  it('produces the design default of 100 stars', () => {
    expect(generateStars()).toHaveLength(STAR_COUNT);
  });

  it('is deterministic for a given seed', () => {
    expect(generateStars(57)).toEqual(generateStars(57));
  });

  it('keeps every star inside the stage bounds', () => {
    for (const star of generateStars()) {
      expect(star.x).toBeGreaterThanOrEqual(8);
      expect(star.x).toBeLessThanOrEqual(100);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(100);
      expect(star.r).toBeGreaterThan(0);
      expect(star.o).toBeGreaterThan(0);
    }
  });
});
