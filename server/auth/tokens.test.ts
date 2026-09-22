import { describe, expect, it } from 'vitest';
import { generateToken, hashToken } from './tokens.ts';

describe('tokens', () => {
  it('generates distinct opaque tokens', () => {
    expect(generateToken()).not.toEqual(generateToken());
  });

  it('hashes a token deterministically to a 64-char hex string', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toEqual(hash);
  });

  it('is not reversible from the stored hash', () => {
    const token = generateToken();
    expect(hashToken(token)).not.toContain(token);
  });
});
