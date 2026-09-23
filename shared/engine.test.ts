import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { alloyMineOutput } from './economy.ts';
import { advance, type EconomyState, liveProfile, nextEventAt, type Structures } from './engine.ts';

const HOUR = 3_600_000;

const NO_STRUCTURES: Structures = {
  alloyMine: 0,
  crystalMine: 0,
  deuteriumSynth: 0,
  solarPlant: 0,
  fusionReactor: 0,
  alloyStorage: 0,
  crystalStorage: 0,
  deuteriumStorage: 0,
};

function state(overrides: Partial<EconomyState> = {}): EconomyState {
  const { structures, ...rest } = overrides;
  return {
    resources: { alloy: 500, crystal: 500, deuterium: 0 },
    lastUpdatedAt: 0,
    solarSatellites: 0,
    energyTech: 0,
    plasmaTech: 0,
    position: 4, // no production bonus
    tavg: 50,
    ...rest,
    structures: { ...NO_STRUCTURES, ...(structures ?? {}) },
  };
}

describe('advance — plain integration', () => {
  it('accrues base income only for a fresh Planet', () => {
    const next = advance(state(), HOUR, 1);
    expect(next.resources.alloy).toBe(530);
    expect(next.resources.crystal).toBe(515);
    expect(next.resources.deuterium).toBe(0);
    expect(next.lastUpdatedAt).toBe(HOUR);
  });

  it('scales base income by Universe Speed', () => {
    const next = advance(state(), HOUR, 5);
    expect(next.resources.alloy).toBe(500 + 150);
    expect(next.resources.crystal).toBe(500 + 75);
  });
});

describe('advance — Energy shortfall (production factor)', () => {
  it('reduces mine output by the production factor', () => {
    const s = state({ structures: { ...NO_STRUCTURES, alloyMine: 10, solarPlant: 5 } });
    const profile = liveProfile(s, 1);
    expect(profile.energy.productionFactor).toBe(0.61); // 161/260 floored to whole %

    const next = advance(s, HOUR, 1);
    const expectedRate = 30 + alloyMineOutput(10, { factor: 0.61, position: 4 });
    expect(next.resources.alloy).toBe(500 + expectedRate);
  });
});

describe('advance — Deuterium depletion and Fusion throttle', () => {
  // Solar alone covers the mines, so the factor stays 1; only Fusion is starved of Deuterium.
  const s = state({
    resources: { alloy: 500, crystal: 500, deuterium: 156 },
    structures: { ...NO_STRUCTURES, deuteriumSynth: 5, solarPlant: 10, fusionReactor: 8 },
  });

  it('schedules a boundary at the depletion moment', () => {
    expect(nextEventAt(s, 1, 0)).toBe(2 * HOUR); // 156 / 78 per hour = 2h
  });

  it('drains Deuterium to exactly 0 at the boundary', () => {
    const at2h = advance(s, 2 * HOUR, 1);
    expect(at2h.resources.deuterium).toBe(0);
  });

  it('holds Deuterium at 0 afterwards with no toggling', () => {
    const at4h = advance(s, 4 * HOUR, 1);
    expect(at4h.resources.deuterium).toBe(0);
    // Base income still accrues while Fusion is throttled.
    expect(at4h.resources.alloy).toBe(500 + 120);

    // Advancing in steps lands in exactly the same place (the throttle does not toggle).
    const stepped = advance(advance(advance(s, 2 * HOUR, 1), 3 * HOUR, 1), 4 * HOUR, 1);
    expect(stepped.resources).toEqual(at4h.resources);
  });
});

describe('advance — Storage Capacity', () => {
  it('caps a Resource that reaches capacity mid-interval', () => {
    const s = state({ resources: { alloy: 9990, crystal: 500, deuterium: 0 } });
    const next = advance(s, HOUR, 1); // +30/h would overshoot 10 000 after 20 min
    expect(next.resources.alloy).toBe(10000);
  });

  it('keeps an amount already above the cap but does not grow it', () => {
    const s = state({ resources: { alloy: 15000, crystal: 500, deuterium: 0 } });
    const next = advance(s, HOUR, 1);
    expect(next.resources.alloy).toBe(15000);
    expect(next.resources.crystal).toBe(515); // still under its cap, so it grows
  });
});

describe('advance — Build Slots', () => {
  // An Alloy Extractor finishing at 1h, with a Solar Array already up so Energy never limits it.
  const s = state({
    resources: { alloy: 500, crystal: 500, deuterium: 0 },
    structures: { ...NO_STRUCTURES, alloyMine: 0, solarPlant: 10 },
    buildSlots: [
      {
        slot: 1,
        structureKey: 'alloy-extractor',
        field: 'alloyMine',
        targetLevel: 1,
        endsAt: HOUR,
      },
    ],
  });

  it('raises the level and frees the slot once the clock passes endsAt', () => {
    const after = advance(s, 2 * HOUR, 1);
    expect(after.structures.alloyMine).toBe(1);
    expect(after.buildSlots).toEqual([]);
  });

  it('keeps the slot busy and the level unchanged before endsAt', () => {
    const before = advance(s, HOUR / 2, 1);
    expect(before.structures.alloyMine).toBe(0);
    expect(before.buildSlots).toHaveLength(1);
    // Only base income so far: +30/h for half an hour.
    expect(before.resources.alloy).toBe(500 + 15);
  });

  it('splits the integration at endsAt: old level before, new level after', () => {
    const after = advance(s, 2 * HOUR, 1);
    // [0,1h] base income only (+30); [1h,2h] base + Alloy Extractor 1 at factor 1 (+63).
    const perHourAfter = 30 + alloyMineOutput(1, { factor: 1, position: 4 });
    expect(after.resources.alloy).toBe(500 + 30 + perHourAfter);
  });

  it('schedules the completion as the next boundary', () => {
    expect(nextEventAt(s, 1, 0)).toBe(HOUR);
  });

  it('does not change production for a non-economy Structure (field null)', () => {
    const robotics = state({
      structures: { ...NO_STRUCTURES },
      buildSlots: [
        {
          slot: 1,
          structureKey: 'robotics-works',
          field: null,
          targetLevel: 1,
          endsAt: HOUR,
        },
      ],
    });
    const after = advance(robotics, 2 * HOUR, 1);
    expect(after.buildSlots).toEqual([]); // slot still frees
    expect(after.resources.alloy).toBe(500 + 60); // base income across the whole 2h, unaffected
  });
});

describe('advance — determinism property', () => {
  it('advancing through an intermediate time equals advancing straight there', () => {
    const arbState = fc.record({
      resources: fc.record({
        alloy: fc.integer({ min: 0, max: 20000 }),
        crystal: fc.integer({ min: 0, max: 20000 }),
        deuterium: fc.integer({ min: 0, max: 5000 }),
      }),
      structures: fc.record({
        alloyMine: fc.integer({ min: 0, max: 15 }),
        crystalMine: fc.integer({ min: 0, max: 15 }),
        deuteriumSynth: fc.integer({ min: 0, max: 15 }),
        solarPlant: fc.integer({ min: 0, max: 15 }),
        fusionReactor: fc.integer({ min: 0, max: 12 }),
        alloyStorage: fc.integer({ min: 0, max: 3 }),
        crystalStorage: fc.integer({ min: 0, max: 3 }),
        deuteriumStorage: fc.integer({ min: 0, max: 3 }),
      }),
      solarSatellites: fc.integer({ min: 0, max: 50 }),
      energyTech: fc.integer({ min: 0, max: 20 }),
      plasmaTech: fc.integer({ min: 0, max: 30 }),
      position: fc.integer({ min: 1, max: 15 }),
      tavg: fc.integer({ min: -20, max: 100 }),
      speed: fc.integer({ min: 1, max: 8 }),
      t2: fc.integer({ min: 1, max: 240 * HOUR }),
      split: fc.double({ min: 0, max: 1, noNaN: true }),
    });

    fc.assert(
      fc.property(arbState, (a) => {
        const s: EconomyState = { ...a, lastUpdatedAt: 0 };
        const t1 = Math.floor(a.t2 * a.split);
        const direct = advance(s, a.t2, a.speed);
        const stepped = advance(advance(s, t1, a.speed), a.t2, a.speed);
        for (const key of ['alloy', 'crystal', 'deuterium'] as const) {
          expect(Math.abs(direct.resources[key] - stepped.resources[key])).toBeLessThan(1e-3);
        }
      }),
      { numRuns: 500 },
    );
  });
});
