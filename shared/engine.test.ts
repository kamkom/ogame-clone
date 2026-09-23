import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  alloyMineEnergyUse,
  alloyMineOutput,
  productionFactor,
  researchDurationSec,
  shipUnitDurationSec,
} from './economy.ts';
import {
  advance,
  type EconomyState,
  liveProfile,
  nextEventAt,
  type ResearchEntry,
  type ShipyardOrder,
  type Structures,
} from './engine.ts';

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
  researchLab: 0,
  orbitalShipyard: 0,
  naniteFoundry: 0,
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

describe('advance — Research Queue', () => {
  // Energy Theory L1 costs 0 / 800: 1440 s at Lab 1; L2 (0 / 1600) is 2880 s at Lab 1.
  const E1 = 1440_000;
  const E2 = 2880_000;
  const s = state({
    structures: { ...NO_STRUCTURES, researchLab: 1 },
    researchQueue: [
      {
        id: 1,
        technologyKey: 'energy-theory',
        field: 'energyTech',
        targetLevel: 1,
        cost: { alloy: 0, crystal: 800 },
        startedAt: 0,
        endsAt: E1,
      },
      {
        id: 2,
        technologyKey: 'energy-theory',
        field: 'energyTech',
        targetLevel: 2,
        cost: { alloy: 0, crystal: 1600 },
        startedAt: null,
        endsAt: null,
      },
    ],
  });

  it('keeps the head running and the next entry waiting before the head ends', () => {
    const before = advance(s, E1 - 1, 1);
    expect(before.energyTech).toBe(0);
    expect(before.researchQueue).toHaveLength(2);
    expect(before.researchQueue![1]).toMatchObject({ startedAt: null, endsAt: null });
  });

  it('finishes the head and starts the next at the boundary time, its duration fixed then', () => {
    const after = advance(s, E1 + 1000, 1);
    expect(after.energyTech).toBe(1);
    expect(after.researchQueue).toEqual([
      expect.objectContaining({ id: 2, startedAt: E1, endsAt: E1 + E2 }),
    ]);
  });

  it('runs the whole queue in order when the clock passes both', () => {
    const after = advance(s, 10 * HOUR, 1);
    expect(after.energyTech).toBe(2);
    expect(after.researchQueue).toEqual([]);
  });

  it('fixes the next duration from the Lab level at the moment it starts', () => {
    // A Lab upgrade to 3 finishes before the head does, so the second entry runs at Lab 3.
    const withLab = {
      ...s,
      buildSlots: [
        {
          slot: 1,
          structureKey: 'research-lab',
          field: 'researchLab' as const,
          targetLevel: 3,
          endsAt: 1000,
        },
      ],
    };
    const after = advance(withLab, E1 + 1000, 1);
    expect(after.structures.researchLab).toBe(3);
    const lab3 = researchDurationSec(0, 1600, 3, 1) * 1000;
    expect(after.researchQueue![0]).toMatchObject({ startedAt: E1, endsAt: E1 + lab3 });
  });

  it('schedules the head completion as the next boundary', () => {
    expect(nextEventAt(s, 1, 0)).toBe(E1);
  });

  it('raises production from a Plasma Containment completion at its endsAt', () => {
    const plasma = state({
      resources: { alloy: 500, crystal: 500, deuterium: 0 },
      structures: { ...NO_STRUCTURES, alloyMine: 10, solarPlant: 20, researchLab: 1 },
      plasmaTech: 0,
      researchQueue: [
        {
          id: 7,
          technologyKey: 'plasma-containment',
          field: 'plasmaTech',
          targetLevel: 1,
          cost: { alloy: 2000, crystal: 4000 },
          startedAt: 0,
          endsAt: HOUR,
        },
      ],
    });
    const after = advance(plasma, 2 * HOUR, 1);
    expect(after.plasmaTech).toBe(1);
    const before = alloyMineOutput(10, { position: 4 });
    const boosted = alloyMineOutput(10, { position: 4, plasma: 1 });
    expect(boosted).toBeGreaterThan(before);
    expect(after.resources.alloy).toBe(500 + 30 + before + 30 + boosted);
  });

  it('does not change production for a Technology with no economy effect (field null)', () => {
    const lasers = state({
      structures: { ...NO_STRUCTURES, researchLab: 1 },
      researchQueue: [
        {
          id: 3,
          technologyKey: 'photon-lasers',
          field: null,
          targetLevel: 1,
          cost: { alloy: 200, crystal: 100 },
          startedAt: 0,
          endsAt: HOUR,
        },
      ],
    });
    const after = advance(lasers, 2 * HOUR, 1);
    expect(after.researchQueue).toEqual([]);
    expect(after.resources.alloy).toBe(500 + 60);
  });
});

describe('advance — Shipyard Orders', () => {
  // Interceptor (3000 / 1000) at Shipyard 1: 2880 s per unit.
  const UNIT = 2_880_000;
  const interceptors: ShipyardOrder = {
    id: 1,
    shipKey: 'interceptor',
    solarSatellite: false,
    quantity: 3,
    completed: 0,
    unitCost: { alloy: 3000, crystal: 1000 },
    unitDurationMs: UNIT,
    startedAt: 0,
  };
  // Hauler (2000 / 2000): 1920 s per unit at Shipyard 2, 2880 s at Shipyard 1.
  const haulers: ShipyardOrder = {
    id: 2,
    shipKey: 'hauler',
    solarSatellite: false,
    quantity: 2,
    completed: 0,
    unitCost: { alloy: 2000, crystal: 2000 },
    unitDurationMs: null,
    startedAt: null,
  };
  const s = state({
    structures: { ...NO_STRUCTURES, orbitalShipyard: 1 },
    shipyardOrders: [interceptors, haulers],
  });

  it('finishes units one at a time', () => {
    expect(advance(s, UNIT - 1, 1).shipyardOrders![0]).toMatchObject({ id: 1, completed: 0 });
    expect(advance(s, UNIT, 1).shipyardOrders![0]).toMatchObject({ id: 1, completed: 1 });
    expect(advance(s, 2 * UNIT + 5, 1).shipyardOrders![0]).toMatchObject({ id: 1, completed: 2 });
  });

  it('starts the second Order when the first finishes, its unit time fixed then', () => {
    const after = advance(s, 3 * UNIT + 1000, 1);
    expect(after.shipyardOrders).toEqual([
      { ...haulers, completed: 0, startedAt: 3 * UNIT, unitDurationMs: UNIT },
    ]);
  });

  it('fixes the next unit time from the Shipyard level at the moment it becomes head', () => {
    const withUpgrade = {
      ...s,
      buildSlots: [
        {
          slot: 1,
          structureKey: 'orbital-shipyard',
          field: 'orbitalShipyard' as const,
          targetLevel: 2,
          endsAt: 1000,
        },
      ],
    };
    const after = advance(withUpgrade, 3 * UNIT + 1000, 1);
    const shipyard2 = shipUnitDurationSec(2000, 2000, 2, 0, 1) * 1000;
    expect(after.shipyardOrders![0]).toMatchObject({
      id: 2,
      startedAt: 3 * UNIT,
      unitDurationMs: shipyard2,
    });
  });

  it('empties the queue once every unit has finished', () => {
    expect(advance(s, 10 * UNIT, 1).shipyardOrders).toEqual([]);
  });

  it('schedules the next unit as the next boundary', () => {
    expect(nextEventAt(s, 1, 0)).toBe(UNIT);
    expect(nextEventAt(advance(s, UNIT + 5, 1), 1, UNIT + 5)).toBe(2 * UNIT);
  });

  it('raises Energy with each Solar Satellite at its own boundary', () => {
    // Alloy Extractor 10 needs 260 Energy and nothing produces any, until satellites roll out.
    // At Tavg 50 each satellite gives floor(210 / 6) = 35.
    const sats = state({
      structures: { ...NO_STRUCTURES, alloyMine: 10, orbitalShipyard: 1 },
      shipyardOrders: [
        {
          id: 3,
          shipKey: 'solar-satellite',
          solarSatellite: true,
          quantity: 3,
          completed: 0,
          unitCost: { alloy: 0, crystal: 2000 },
          unitDurationMs: HOUR,
          startedAt: 0,
        },
      ],
    });
    const oneAt = advance(sats, HOUR, 1);
    expect(oneAt.solarSatellites).toBe(1);
    expect(liveProfile(oneAt, 1).energy.produced).toBe(35);

    const after = advance(sats, 3 * HOUR, 1);
    expect(after.solarSatellites).toBe(3);
    expect(after.shipyardOrders).toEqual([]);
    const use = alloyMineEnergyUse(10);
    const hour = (n: number) =>
      30 + alloyMineOutput(10, { position: 4, factor: productionFactor(35 * n, use) });
    expect(after.resources.alloy).toBeCloseTo(500 + hour(0) + hour(1) + hour(2), 6);
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
        researchLab: fc.integer({ min: 0, max: 12 }),
        orbitalShipyard: fc.integer({ min: 1, max: 12 }),
        naniteFoundry: fc.integer({ min: 0, max: 2 }),
      }),
      solarSatellites: fc.integer({ min: 0, max: 50 }),
      energyTech: fc.integer({ min: 0, max: 20 }),
      plasmaTech: fc.integer({ min: 0, max: 30 }),
      position: fc.integer({ min: 1, max: 15 }),
      tavg: fc.integer({ min: -20, max: 100 }),
      speed: fc.integer({ min: 1, max: 8 }),
      t2: fc.integer({ min: 1, max: 240 * HOUR }),
      split: fc.double({ min: 0, max: 1, noNaN: true }),
      research: fc.boolean(),
      shipyard: fc.boolean(),
    });

    // A queue whose later entries start mid-interval, at boundaries the stepped run must reproduce.
    const queue = (lab: number): ResearchEntry[] => [
      {
        id: 1,
        technologyKey: 'energy-theory',
        field: 'energyTech',
        targetLevel: 1,
        cost: { alloy: 0, crystal: 800 },
        startedAt: 0,
        endsAt: researchDurationSec(0, 800, lab, 1) * 1000,
      },
      ...[2, 3].map((id) => ({
        id,
        technologyKey: 'plasma-containment',
        field: 'plasmaTech' as const,
        targetLevel: id - 1,
        cost: { alloy: 2000 * 2 ** (id - 2), crystal: 4000 * 2 ** (id - 2) },
        startedAt: null,
        endsAt: null,
      })),
    ];

    // Satellites whose units land mid-interval, then Interceptors starting at their end.
    const orders: ShipyardOrder[] = [
      {
        id: 1,
        shipKey: 'solar-satellite',
        solarSatellite: true,
        quantity: 20,
        completed: 0,
        unitCost: { alloy: 0, crystal: 2000 },
        unitDurationMs: null,
        startedAt: null,
      },
      {
        id: 2,
        shipKey: 'interceptor',
        solarSatellite: false,
        quantity: 50,
        completed: 0,
        unitCost: { alloy: 3000, crystal: 1000 },
        unitDurationMs: null,
        startedAt: null,
      },
    ];

    fc.assert(
      fc.property(arbState, (a) => {
        const { research, shipyard, ...rest } = a;
        const s: EconomyState = {
          ...rest,
          lastUpdatedAt: 0,
          researchQueue: research ? queue(a.structures.researchLab) : [],
          shipyardOrders: shipyard ? orders : [],
        };
        const t1 = Math.floor(a.t2 * a.split);
        const direct = advance(s, a.t2, a.speed);
        const stepped = advance(advance(s, t1, a.speed), a.t2, a.speed);
        for (const key of ['alloy', 'crystal', 'deuterium'] as const) {
          expect(Math.abs(direct.resources[key] - stepped.resources[key])).toBeLessThan(1e-3);
        }
        expect(stepped.plasmaTech).toBe(direct.plasmaTech);
        expect(stepped.energyTech).toBe(direct.energyTech);
        expect(stepped.researchQueue).toEqual(direct.researchQueue);
        expect(stepped.shipyardOrders).toEqual(direct.shipyardOrders);
        expect(stepped.solarSatellites).toBe(direct.solarSatellites);
      }),
      { numRuns: 500 },
    );
  });
});
