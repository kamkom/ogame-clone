import { createHash, randomBytes } from 'node:crypto';

// The session cookie carries an opaque 32-byte token (base64url). The database stores only its
// SHA-256, so a leaked database row can't be turned back into a usable cookie.
const TOKEN_BYTES = 32;

/** A fresh opaque session token, safe to put in a cookie. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** The SHA-256 of a token, hex-encoded — what we store and look up by. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
