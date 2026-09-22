import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Self-describing scrypt hashes: `scrypt$N$r$p$saltB64$hashB64`. The parameters live in the
// string, so verifying an old hash never needs the current cost settings, and we can raise
// the cost later without breaking existing Players.
const N = 16384; // CPU/memory cost (2^14)
const R = 8;
const P = 1;
const KEYLEN = 32;
const SALT_BYTES = 16;

/** Hash a password into a self-describing scrypt string. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/**
 * Verify a password against a stored self-describing hash. Always runs scrypt (so a malformed
 * or unknown hash still costs the same work) and compares with `timingSafeEqual`.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4]!, 'base64');
  const expected = Buffer.from(parts[5]!, 'base64');
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const actual = scryptSync(password, salt, expected.length, { N: n, r, p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// A precomputed hash of a throwaway password. The login route verifies against this when the
// username is unknown, so an attacker can't tell "no such user" from "wrong password" by timing.
export const DUMMY_HASH = hashPassword('dummy-password-for-timing');
