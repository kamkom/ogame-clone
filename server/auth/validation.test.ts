import { describe, expect, it } from 'vitest';
import { validateRegistration } from './validation.ts';

describe('validateRegistration', () => {
  it('accepts a valid username and password', () => {
    expect(validateRegistration('Vega_1', 'password1')).toEqual({});
  });

  it('rejects a too-short username and bad characters', () => {
    expect(validateRegistration('ab', 'password1').username).toBe('invalid');
    expect(validateRegistration('has space', 'password1').username).toBe('invalid');
    expect(validateRegistration('bad!', 'password1').username).toBe('invalid');
  });

  it('rejects passwords outside 8..128', () => {
    expect(validateRegistration('Vega', 'short').password).toBe('length');
    expect(validateRegistration('Vega', 'x'.repeat(129)).password).toBe('length');
  });

  it('rejects non-string inputs', () => {
    const e = validateRegistration(undefined, 42);
    expect(e.username).toBe('invalid');
    expect(e.password).toBe('length');
  });
});
