import type { PlanetNameError } from '#shared/planetName.ts';

// Copy for a rejected Planet name, shared by the welcome window and the popover. Kept pure so the
// code→text mapping is unit-tested without rendering React.
const MESSAGES: Record<PlanetNameError, string> = {
  length: 'Use 2–20 characters.',
  chars: 'Use letters, digits, space, - or _.',
  spaces: 'No double spaces.',
};

/** Inline message for a rejected Planet name, or undefined when the name is valid. */
export function planetNameMessage(code: PlanetNameError | undefined): string | undefined {
  if (!code) return undefined;
  return MESSAGES[code] ?? 'That name isn’t allowed.';
}
