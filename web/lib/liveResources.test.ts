import { describe, expect, it } from 'vitest';
import type { PlanetSnapshot } from './api.ts';
import {
  energyBalance,
  interpolateResource,
  liveResources,
  refetchDelay,
} from './liveResources.ts';

const HOUR = 3_600_000;

function snapshot(overrides: Partial<PlanetSnapshot> = {}): PlanetSnapshot {
  return {
    id: 1,
    name: 'Homeworld',
    coordinates: { galaxy: 1, system: 1, position: 4 },
    coordinatesLabel: '[1:1:4]',
    temperature: { min: 30, max: 70 },
    fields: { used: 0, max: 163 },
    diameterKm: 12800,
    resources: { alloy: 500, crystal: 500, deuterium: 0 },
    serverNow: 0,
    lastUpdatedAt: 0,
    ratesPerHour: { alloy: 30, crystal: 15, deuterium: 0 },
    storageCapacity: { alloy: 10000, crystal: 10000, deuterium: 10000 },
    energy: { produced: 0, consumed: 0, productionFactor: 1 },
    nextEventAt: null,
    ...overrides,
  };
}

describe('interpolateResource', () => {
  it('grows linearly at the per-hour rate', () => {
    expect(interpolateResource(500, 30, 10000, 0, HOUR)).toBe(530);
    expect(interpolateResource(500, 30, 10000, 0, HOUR / 2)).toBe(515);
  });

  it('never grows past the cap', () => {
    expect(interpolateResource(9990, 30, 10000, 0, HOUR)).toBe(10000);
  });

  it('keeps an amount already above the cap without growing it', () => {
    expect(interpolateResource(15000, 30, 10000, 0, HOUR)).toBe(15000);
  });

  it('drains but never below zero', () => {
    expect(interpolateResource(100, -300, 10000, 0, HOUR)).toBe(0);
  });

  it('ignores a `now` before the last update', () => {
    expect(interpolateResource(500, 30, 10000, HOUR, 0)).toBe(500);
  });
});

describe('liveResources', () => {
  it('interpolates all three Resources', () => {
    const live = liveResources(snapshot(), HOUR);
    expect(live).toEqual({ alloy: 530, crystal: 515, deuterium: 0 });
  });
});

describe('energyBalance', () => {
  it('is produced − consumed', () => {
    expect(
      energyBalance(snapshot({ energy: { produced: 200, consumed: 130, productionFactor: 1 } })),
    ).toBe(70);
    expect(
      energyBalance(snapshot({ energy: { produced: 0, consumed: 260, productionFactor: 0 } })),
    ).toBe(-260);
  });
});

describe('refetchDelay', () => {
  it('is null when no event is scheduled', () => {
    expect(refetchDelay(snapshot(), 0)).toBeNull();
  });

  it('is the time until the next event, clamped at 0', () => {
    expect(refetchDelay(snapshot({ nextEventAt: 5000 }), 1000)).toBe(4000);
    expect(refetchDelay(snapshot({ nextEventAt: 5000 }), 9000)).toBe(0);
  });
});
