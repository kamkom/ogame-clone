import type { Coordinates } from '#shared/coords.ts';

// New Players land at positions 4–12, whose temperature ranges are never extreme
// (spec story 17, rules reference §"Temperature by position").
export const MIN_POSITION = 4;
export const MAX_POSITION = 12;

// `Tmax` is drawn uniformly from the position's range; `Tmin = Tmax − 40`.
export const TMAX_RANGE: Record<number, readonly [number, number]> = {
  4: [70, 110],
  5: [60, 100],
  6: [50, 90],
  7: [40, 80],
  8: [30, 70],
  9: [20, 60],
  10: [10, 50],
  11: [0, 40],
  12: [-10, 30],
};

export const TMIN_OFFSET = 40;

/** A random function returning a float in [0, 1), matching `Math.random`. */
export type Rng = () => number;

/** Uniform integer in [min, max], inclusive. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Draw galaxy/system/position uniformly from the configured ranges and 4–12. */
export function drawCoordinates(rng: Rng, galaxies: number, systems: number): Coordinates {
  return {
    galaxy: randomInt(rng, 1, galaxies),
    system: randomInt(rng, 1, systems),
    position: randomInt(rng, MIN_POSITION, MAX_POSITION),
  };
}

/** Draw an integer `Tmax` from the given position's range. */
export function drawTmax(rng: Rng, position: number): number {
  const range = TMAX_RANGE[position];
  if (!range) throw new Error(`No temperature range for position ${position}`);
  return randomInt(rng, range[0], range[1]);
}
