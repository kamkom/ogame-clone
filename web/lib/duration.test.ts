import { describe, expect, it } from 'vitest';
import { formatCountdown, formatDuration } from './duration.ts';

describe('formatDuration', () => {
  it('shows hours and zero-padded minutes above an hour', () => {
    expect(formatDuration(3600 + 12 * 60)).toBe('1h 12m');
    expect(formatDuration(3600 + 4 * 60)).toBe('1h 04m');
    expect(formatDuration(3 * 3600 + 40 * 60)).toBe('3h 40m');
  });

  it('shows minutes and zero-padded seconds under an hour', () => {
    expect(formatDuration(48 * 60 + 20)).toBe('48m 20s');
    expect(formatDuration(26 * 60 + 10)).toBe('26m 10s');
  });

  it('shows just seconds under a minute', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(0)).toBe('0s');
  });
});

describe('formatCountdown', () => {
  it('formats remaining milliseconds as HH:MM:SS', () => {
    expect(formatCountdown((42 * 60 + 18) * 1000)).toBe('00:42:18');
    expect(formatCountdown((3600 + 30 * 60 + 5) * 1000)).toBe('01:30:05');
  });

  it('never goes negative', () => {
    expect(formatCountdown(-5000)).toBe('00:00:00');
  });
});
