import { describe, expect, it } from 'vitest';
import { bannerMessage, passwordMessage, usernameMessage } from './messages.ts';

describe('auth messages', () => {
  it('maps credential and rate-limit errors to banners', () => {
    expect(bannerMessage('invalid_credentials')).toBe('Invalid username or password.');
    expect(bannerMessage('too_many_attempts')).toMatch(/Too many failed attempts/);
  });

  it('has no banner without an error code', () => {
    expect(bannerMessage(undefined)).toBeNull();
  });

  it('maps field codes to inline messages', () => {
    expect(usernameMessage('invalid')).toMatch(/3–20/);
    expect(usernameMessage('taken')).toMatch(/taken/);
    expect(passwordMessage('length')).toMatch(/8–128/);
    expect(usernameMessage(undefined)).toBeUndefined();
    expect(passwordMessage(undefined)).toBeUndefined();
  });
});
