// The design's star field: a seeded PRNG (Lehmer / MINSTD, seed 57, 100 stars), copied
// verbatim from design/source/command-deck.dc.html so the port is pixel-identical.

export interface Star {
  /** left, as a percentage of the stage width. */
  x: number;
  /** top, as a percentage of the stage height. */
  y: number;
  /** diameter in px. */
  r: number;
  /** opacity 0..1. */
  o: number;
}

export const STAR_SEED = 57;
export const STAR_COUNT = 100;

export function generateStars(seed: number = STAR_SEED, count: number = STAR_COUNT): Star[] {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Number((8 + rnd() * 92).toFixed(2)),
      y: Number((rnd() * 100).toFixed(2)),
      r: Number((0.6 + rnd() * 1.2).toFixed(1)),
      o: Number((0.12 + rnd() * 0.45).toFixed(2)),
    });
  }
  return stars;
}
