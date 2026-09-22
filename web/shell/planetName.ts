import type { PlanetNameError } from '#shared/planetName.ts';
import { ApiError } from '../lib/api.ts';

// Copy for a rejected Planet name, shared by the welcome window and the popover. Kept pure so the
// code→text mapping is unit-tested without rendering React.
const MESSAGES: Record<PlanetNameError, string> = {
  length: 'Use 2–20 characters.',
  chars: 'Use letters, digits, space, - or _.',
  spaces: 'No double spaces.',
};

/** Inline message for a rejected Planet name, or undefined when there is no error code. */
export function planetNameMessage(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return MESSAGES[code as PlanetNameError] ?? 'That name isn’t allowed.';
}

/** Inline message for a failed rename request: its validation code, or a generic fallback. */
export function renameErrorMessage(err: unknown): string {
  const code = err instanceof ApiError ? err.body?.code : undefined;
  return planetNameMessage(code) ?? 'Couldn’t save that name. Try again.';
}
