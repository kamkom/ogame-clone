// Client-side live counters. These are plain, pure logic modules so they can be unit-tested
// without a browser; TopBar wires them to a ticking clock. They mirror the server engine's
// closed-form accrual and Storage Capacity rule, but only for display between fetches.

import type { PlanetSnapshot } from './api.ts';

const MS_PER_HOUR = 3_600_000;

/**
 * The stock of one Resource interpolated to wall-clock `now`, honouring the cap: it never grows
 * past capacity, and an amount already above the cap is kept but does not grow (matches §6.4).
 */
export function interpolateResource(
  stock: number,
  ratePerHour: number,
  cap: number,
  lastUpdatedAt: number,
  now: number,
): number {
  const dtHours = Math.max(0, now - lastUpdatedAt) / MS_PER_HOUR;
  const projected = stock + ratePerHour * dtHours;
  if (ratePerHour < 0) return Math.max(0, projected);
  if (stock >= cap) return stock;
  return Math.min(cap, projected);
}

export interface LiveResources {
  alloy: number;
  crystal: number;
  deuterium: number;
}

/** Interpolate all three stockpiled Resources to `now`. */
export function liveResources(snapshot: PlanetSnapshot, now: number): LiveResources {
  const at = (key: keyof LiveResources): number =>
    interpolateResource(
      snapshot.resources[key],
      snapshot.ratesPerHour[key],
      snapshot.storageCapacity[key],
      snapshot.lastUpdatedAt,
      now,
    );
  return { alloy: at('alloy'), crystal: at('crystal'), deuterium: at('deuterium') };
}

/** The Planet's Energy balance = produced − consumed. It is never stockpiled, so it is constant. */
export function energyBalance(snapshot: PlanetSnapshot): number {
  return snapshot.energy.produced - snapshot.energy.consumed;
}

/** Milliseconds until the next boundary refetch, or null when nothing is scheduled. */
export function refetchDelay(snapshot: PlanetSnapshot, now: number): number | null {
  if (snapshot.nextEventAt === null) return null;
  const delay = snapshot.nextEventAt - now;
  // The server settles every due event before answering, so a due one means a stale answer;
  // back off rather than refetching in a tight loop.
  return delay > 0 ? delay : DUE_EVENT_RETRY_MS;
}

const DUE_EVENT_RETRY_MS = 1000;
