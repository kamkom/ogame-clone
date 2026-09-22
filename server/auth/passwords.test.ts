import { describe, expect, it } from 'vitest';
import { DUMMY_HASH, hashPassword, verifyPassword } from './passwords.ts';

describe('passwords', () => {
  it('round-trips a password through a self-describing hash', () => {
    const hash = hashPassword('correct horse battery');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('correct horse battery', hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashPassword('correct horse battery');
    expect(verifyPassword('wrong password', hash)).toBe(false);
  });

  it('produces a distinct salt per hash', () => {
    expect(hashPassword('same')).not.toEqual(hashPassword('same'));
  });

  it('rejects a malformed stored hash without throwing', () => {
    expect(verifyPassword('anything', 'not-a-hash')).toBe(false);
    expect(verifyPassword('anything', '')).toBe(false);
  });

  it('exposes a usable dummy hash for unknown-user timing', () => {
    expect(verifyPassword('dummy-password-for-timing', DUMMY_HASH)).toBe(true);
    expect(verifyPassword('anything-else', DUMMY_HASH)).toBe(false);
  });
});
