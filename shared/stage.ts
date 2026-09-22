// The whole game renders on a fixed 1440×900 stage that is scaled to fit the viewport.
// These constants and the scale function are shared so server and web never disagree.

export const STAGE_WIDTH = 1440;
export const STAGE_HEIGHT = 900;

// Below this scale the stage stops shrinking and the page scrolls instead (spec story 85).
export const STAGE_SCALE_FLOOR = 0.75;

/**
 * Scale that fits the 1440×900 stage into a viewport, up or down, with a hard floor.
 * `min(vw/1440, vh/900)`, clamped to at least STAGE_SCALE_FLOOR.
 */
export function computeStageScale(
  viewportWidth: number,
  viewportHeight: number,
  floor: number = STAGE_SCALE_FLOOR,
): number {
  const raw = Math.min(viewportWidth / STAGE_WIDTH, viewportHeight / STAGE_HEIGHT);
  if (!Number.isFinite(raw) || raw <= 0) return floor;
  return Math.max(raw, floor);
}
