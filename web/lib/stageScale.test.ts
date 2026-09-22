import { describe, expect, it } from 'vitest';
import { computeStageScale, STAGE_SCALE_FLOOR } from '#shared/stage.ts';

describe('computeStageScale', () => {
  it('is exactly 1 at the design size', () => {
    expect(computeStageScale(1440, 900)).toBe(1);
  });

  it('takes the smaller of the two axis ratios', () => {
    // 1280/1440 = 0.8889, 760/900 = 0.8444 -> min
    expect(computeStageScale(1280, 760)).toBeCloseTo(0.844, 3);
  });

  it('upscales above the design size', () => {
    expect(computeStageScale(2880, 1800)).toBe(2);
  });

  it('does not shrink below the floor', () => {
    expect(computeStageScale(720, 450)).toBe(STAGE_SCALE_FLOOR);
    expect(computeStageScale(100, 100)).toBe(STAGE_SCALE_FLOOR);
  });

  it('returns the floor for degenerate viewports', () => {
    expect(computeStageScale(0, 0)).toBe(STAGE_SCALE_FLOOR);
  });
});
