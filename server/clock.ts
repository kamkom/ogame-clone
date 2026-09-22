// The one source of "now" in the server. Everything time-based takes a Clock so tests
// drive time with a ManualClock and never touch the wall clock. `Date.now()` is banned
// by lint everywhere except here.

export interface Clock {
  /** Current time as integer epoch milliseconds. */
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

/** A Clock whose time is set explicitly, for tests. */
export class ManualClock implements Clock {
  #now: number;

  constructor(start = 0) {
    this.#now = start;
  }

  now(): number {
    return this.#now;
  }

  /** Jump to an absolute epoch-ms time. */
  set(epochMs: number): void {
    this.#now = epochMs;
  }

  /** Move forward by `ms` milliseconds. */
  advance(ms: number): void {
    this.#now += ms;
  }
}
