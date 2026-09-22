import { describe, expect, it } from 'vitest';
import { ManualClock } from '../clock.ts';
import { LoginLimiter } from './limiter.ts';

describe('LoginLimiter', () => {
  it('blocks only after the 10th failure', () => {
    const clock = new ManualClock(0);
    const limiter = new LoginLimiter(clock);

    for (let i = 0; i < 10; i++) {
      expect(limiter.isBlocked('vega')).toBe(false);
      limiter.recordFailure('vega');
    }
    expect(limiter.isBlocked('vega')).toBe(true);
  });

  it('clears the block after 15 minutes of clock time', () => {
    const clock = new ManualClock(0);
    const limiter = new LoginLimiter(clock);
    for (let i = 0; i < 10; i++) limiter.recordFailure('vega');
    expect(limiter.isBlocked('vega')).toBe(true);

    clock.advance(15 * 60 * 1000 + 1);
    expect(limiter.isBlocked('vega')).toBe(false);
  });

  it('tracks usernames independently', () => {
    const clock = new ManualClock(0);
    const limiter = new LoginLimiter(clock);
    for (let i = 0; i < 10; i++) limiter.recordFailure('vega');
    expect(limiter.isBlocked('vega')).toBe(true);
    expect(limiter.isBlocked('rigel')).toBe(false);
  });

  it('resets a username on success', () => {
    const clock = new ManualClock(0);
    const limiter = new LoginLimiter(clock);
    for (let i = 0; i < 9; i++) limiter.recordFailure('vega');
    limiter.reset('vega');
    for (let i = 0; i < 10; i++) {
      expect(limiter.isBlocked('vega')).toBe(false);
      limiter.recordFailure('vega');
    }
    expect(limiter.isBlocked('vega')).toBe(true);
  });
});
