import type { Clock } from '../clock.ts';

// In-memory brute-force limiter: at most `max` failed logins per username within `windowMs`.
// Once the window holds `max` failures, further attempts are blocked until the oldest failure
// ages out. State lives in this process only (spec #7: the limiter is in memory).

export interface LimiterOptions {
  max?: number;
  windowMs?: number;
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export class LoginLimiter {
  #clock: Clock;
  #max: number;
  #windowMs: number;
  #failures = new Map<string, number[]>();

  constructor(clock: Clock, options: LimiterOptions = {}) {
    this.#clock = clock;
    this.#max = options.max ?? 10;
    this.#windowMs = options.windowMs ?? FIFTEEN_MINUTES;
  }

  /** Recent failures for `key`, with anything older than the window dropped. */
  #recent(key: string): number[] {
    const cutoff = this.#clock.now() - this.#windowMs;
    const kept = (this.#failures.get(key) ?? []).filter((t) => t > cutoff);
    if (kept.length) this.#failures.set(key, kept);
    else this.#failures.delete(key);
    return kept;
  }

  /** True when `key` has hit the failure ceiling inside the current window. */
  isBlocked(key: string): boolean {
    return this.#recent(key).length >= this.#max;
  }

  /** Record one failed attempt for `key`. */
  recordFailure(key: string): void {
    const recent = this.#recent(key);
    recent.push(this.#clock.now());
    this.#failures.set(key, recent);
  }

  /** Clear a key's failures — called on a successful login. */
  reset(key: string): void {
    this.#failures.delete(key);
  }
}
