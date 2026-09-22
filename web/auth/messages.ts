// Copy for the auth screen (variant A). Kept as pure functions so the mapping from API error
// codes to human text is unit-tested without rendering React.

const BANNER: Record<string, string> = {
  invalid_credentials: 'Invalid username or password.',
  too_many_attempts: 'Too many failed attempts. Try again in 15 minutes.',
};

const USERNAME: Record<string, string> = {
  invalid: 'Use 3–20 letters, digits, _ or -.',
  taken: 'That username is taken.',
};

const PASSWORD: Record<string, string> = {
  length: 'Use 8–128 characters.',
};

/** Banner text for a top-level auth error, or null if the code has no banner. */
export function bannerMessage(errorCode: string | undefined): string | null {
  if (!errorCode) return null;
  return BANNER[errorCode] ?? 'Something went wrong. Try again.';
}

/** Inline message for a failed username field, or undefined. */
export function usernameMessage(code: string | undefined): string | undefined {
  return code ? (USERNAME[code] ?? 'Invalid username.') : undefined;
}

/** Inline message for a failed password field, or undefined. */
export function passwordMessage(code: string | undefined): string | undefined {
  return code ? (PASSWORD[code] ?? 'Invalid password.') : undefined;
}
