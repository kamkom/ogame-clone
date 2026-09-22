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

  it('floors fractional amounts', () => {
    expect(formatResource(499.9)).toBe('499');
  });
});
