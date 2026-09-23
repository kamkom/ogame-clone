import { describe, expect, it } from 'vitest';
import { formatResource } from './format.ts';

describe('formatResource', () => {
  it('shows full digits up to 9,999,999', () => {
    expect(formatResource(500)).toBe('500');
    expect(formatResource(9_999_999)).toBe('9,999,999');
  });

  it('uses a compact form above 9,999,999', () => {
    expect(formatResource(12_400_000)).toBe('12.4M');
  });

  it('rounds the compact form down, so it never shows more than the Player has', () => {
    expect(formatResource(12_499_999)).toBe('12.4M');
    expect(formatResource(99_960_000)).toBe('99.9M');
  });

  it('switches to billions past 999.9M', () => {
    expect(formatResource(999_999_999)).toBe('999.9M');
    expect(formatResource(1_234_567_890)).toBe('1.2B');
  });

  it('floors fractional amounts', () => {
    expect(formatResource(499.9)).toBe('499');
  });
});
