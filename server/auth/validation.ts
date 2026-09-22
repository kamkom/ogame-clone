// Credential rules (spec #7). Usernames are 3–20 chars of [A-Za-z0-9_-]; passwords are 8–128
// chars with no composition rules (so a passphrase works).
export const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export type FieldError = 'invalid' | 'taken' | 'length';

/** Validate a registration payload's format. Returns per-field error codes (empty when valid). */
export function validateRegistration(
  username: unknown,
  password: unknown,
): { username?: FieldError; password?: FieldError } {
  const errors: { username?: FieldError; password?: FieldError } = {};
  if (typeof username !== 'string' || !USERNAME_RE.test(username.trim())) {
    errors.username = 'invalid';
  }
  if (
    typeof password !== 'string' ||
    password.length < PASSWORD_MIN ||
    password.length > PASSWORD_MAX
  ) {
    errors.password = 'length';
  }
  return errors;
}
