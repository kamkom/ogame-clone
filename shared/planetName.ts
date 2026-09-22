// Planet name rules (spec #22), shared so the rename route, the welcome window and the planet
// popover all enforce the same thing: trimmed 2–20 chars of Unicode letters, digits, space, `-`
// or `_`, with no runs of spaces.
export const PLANET_NAME_MIN = 2;
export const PLANET_NAME_MAX = 20;

// One or more allowed characters: any Unicode letter or number, plus space, hyphen, underscore.
const ALLOWED_RE = /^[\p{L}\p{N} _-]+$/u;
// Two or more spaces in a row.
const DOUBLE_SPACE_RE = / {2,}/;

export type PlanetNameError = 'length' | 'chars' | 'spaces';

export interface PlanetNameResult {
  /** The trimmed name (returned even when invalid, for echoing back into the field). */
  name: string;
  /** Absent when the name is valid. */
  error?: PlanetNameError;
}

/** Validate and normalise a proposed Planet name. */
export function validatePlanetName(input: unknown): PlanetNameResult {
  const name = typeof input === 'string' ? input.trim() : '';
  // Count by code points so an astral character (were one allowed) is one, not two.
  const length = [...name].length;
  if (length < PLANET_NAME_MIN || length > PLANET_NAME_MAX) return { name, error: 'length' };
  if (!ALLOWED_RE.test(name)) return { name, error: 'chars' };
  if (DOUBLE_SPACE_RE.test(name)) return { name, error: 'spaces' };
  return { name };
}
