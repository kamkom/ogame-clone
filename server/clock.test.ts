import { describe, expect, it } from 'vitest';
import { ManualClock } from './clock.ts';

describe('ManualClock', () => {
  it('starts at 0 by default', () => {
    expect(new ManualClock().now()).toBe(0);
  });

  it('honours a start time', () => {
    expect(new ManualClock(1_000).now()).toBe(1_000);
  });

  it('set jumps to an absolute time', () => {
    const clock = new ManualClock(5);
    clock.set(42);
    expect(clock.now()).toBe(42);
  });

  it('advance moves forward by a delta', () => {
    const clock = new ManualClock(100);
    clock.advance(250);
    expect(clock.now()).toBe(350);
  });
});
