import { describe, expect, it } from 'vitest';
import { shipDef } from '#shared/catalog.ts';
import type { PlanetSnapshot, ShipyardOrderView } from './api.ts';
import {
  buildLabel,
  clampQuantity,
  fleetStrength,
  maxLabel,
  orderAction,
  orderProgress,
  ordersEndAt,
  ordersLabel,
  satelliteEnergyEach,
  shipyardUpgrade,
  shipView,
  waitingOrderSec,
} from './shipyard.ts';

function snapshot(overrides: Partial<PlanetSnapshot> = {}): PlanetSnapshot {
  return {
    universeSpeed: 1,
    planet: {
      id: 1,
      name: 'Homeworld',
      coordinates: { galaxy: 1, system: 1, position: 4 },
      coordinatesLabel: '[1:1:4]',
      tmin: 30,
      tmax: 70,
      fields: { used: 0, inProgress: 0, max: 163 },
      diameterKm: 12800,
    },
    resources: { alloy: 100_000, crystal: 100_000, deuterium: 100_000 },
    serverNow: 0,
    lastUpdatedAt: 0,
    ratesPerHour: { alloy: 30, crystal: 15, deuterium: 0 },
    storageCapacity: { alloy: 1e6, crystal: 1e6, deuterium: 1e6 },
    energy: { produced: 0, consumed: 0, productionFactor: 1 },
    structures: { 'orbital-shipyard': 1 },
    buildSlots: [null, null],
    technologies: {},
    researchQueue: [],
    ships: { 'solar-satellite': 4 },
    shipyardOrders: [],
    nextEventAt: null,
    ...overrides,
  };
}

function order(overrides: Partial<ShipyardOrderView> = {}): ShipyardOrderView {
  return {
    id: 1,
    ship: 'solar-satellite',
    quantity: 3,
    completed: 0,
    cost: { alloy: 0, crystal: 6000, deuterium: 1500 },
    unitDurationMs: 1000,
    startedAt: 0,
    nextUnitAt: 1000,
    endsAt: 3000,
    ...overrides,
  };
}

const satellite = shipDef('solar-satellite')!;
const cruiser = shipDef('cruiser')!;
const stock = { alloy: 100_000, crystal: 100_000, deuterium: 100_000 };

describe('shipView', () => {
  it('shows the docked count, Max N and the per-unit time at the current levels', () => {
    const v = shipView(satellite, snapshot(), 1, stock);
    expect(v.count).toBe(4);
    expect(v.unlocked).toBe(true);
    expect(v.maxN).toBe(50); // 100,000 Crystal / 2000
    expect(v.unitSec).toBe(1440);
  });

  it('marks a ship whose requirements are not met as locked', () => {
    const v = shipView(cruiser, snapshot(), 1, stock);
    expect(v.unlocked).toBe(false);
    expect(v.requirements.filter((r) => !r.met).map((r) => r.key)).toEqual([
      'orbital-shipyard',
      'impulse-drive',
      'ion-lattice',
    ]);
  });
});

describe('clampQuantity', () => {
  it('keeps whole numbers within 1–99,999', () => {
    expect(clampQuantity('10')).toBe(10);
    expect(clampQuantity('0')).toBe(1);
    expect(clampQuantity('')).toBe(1);
    expect(clampQuantity('abc')).toBe(1);
    expect(clampQuantity('3.7')).toBe(3);
    expect(clampQuantity('250000')).toBe(99_999);
  });
});

describe('buildLabel', () => {
  it('names the quantity and ship, plural past one', () => {
    expect(buildLabel(cruiser, 10)).toBe('BUILD 10 CRUISERS');
    expect(buildLabel(cruiser, 1)).toBe('BUILD 1 CRUISER');
    expect(buildLabel(satellite, 3)).toBe('BUILD 3 SOLAR SATELLITES');
  });
});

describe('orderAction', () => {
  it('is enabled when unlocked and affordable', () => {
    const v = shipView(satellite, snapshot(), 1, stock);
    expect(orderAction(snapshot(), v, 3, stock, 0)).toEqual({
      kind: 'ready',
      label: 'BUILD 3 SOLAR SATELLITES',
      enabled: true,
    });
  });

  it('is disabled when locked or the Orders are full', () => {
    expect(orderAction(snapshot(), shipView(cruiser, snapshot(), 1, stock), 1, stock, 0)).toEqual({
      kind: 'locked',
      label: 'LOCKED',
      enabled: false,
    });
    const v = shipView(satellite, snapshot(), 1, stock);
    const full = snapshot({
      shipyardOrders: Array.from({ length: 10 }, (_, i) => order({ id: i })),
    });
    expect(orderAction(full, v, 1, stock, 0)).toEqual({
      kind: 'full',
      label: 'QUEUE FULL · 10 OF 10',
      enabled: false,
    });
  });

  it('says when the quantity becomes affordable at current production (B+C)', () => {
    // 51 satellites need 102,000 Crystal: 2,000 short at 15/h is 133h 20m.
    const v = shipView(satellite, snapshot(), 1, stock);
    expect(orderAction(snapshot(), v, 51, stock, 0)).toEqual({
      kind: 'short',
      label: 'AFFORDABLE IN 5d 13h',
      enabled: false,
    });
    const noCrystal = snapshot({ ratesPerHour: { alloy: 30, crystal: 0, deuterium: 0 } });
    expect(orderAction(noCrystal, v, 51, stock, 0).label).toBe("CAN'T AFFORD YET");
  });

  it('waits for an Orbital Shipyard or Nanite Foundry upgrade: ORDERS OPEN IN (C)', () => {
    const upgrading = snapshot({ buildSlots: [slot('orbital-shipyard', 5_400_000), null] });
    const v = shipView(satellite, upgrading, 1, stock);
    expect(orderAction(upgrading, v, 1, stock, 0)).toEqual({
      kind: 'upgrading',
      label: 'ORDERS OPEN IN 01:30:00',
      enabled: false,
    });
  });
});

function slot(structure: string, endsAt: number, n = 1) {
  return {
    slot: n,
    structure,
    targetLevel: 2,
    cost: { alloy: 800, crystal: 400, deuterium: 200 },
    startedAt: 0,
    endsAt,
  };
}

describe('shipyardUpgrade', () => {
  it('finds the Orbital Shipyard or Nanite Foundry upgrade that ends last, ignoring others', () => {
    expect(shipyardUpgrade(snapshot())).toBeNull();
    expect(shipyardUpgrade(snapshot({ buildSlots: [slot('robotics-works', 10), null] }))).toBe(
      null,
    );
    const both = snapshot({
      buildSlots: [slot('orbital-shipyard', 100), slot('nanite-foundry', 200, 2)],
    });
    expect(shipyardUpgrade(both)?.structure).toBe('nanite-foundry');
  });
});

describe('ordersEndAt', () => {
  it('is null with no Orders, else the head end plus waiting Orders at current levels', () => {
    expect(ordersEndAt(snapshot(), 1)).toBeNull();
    const planet = snapshot({
      shipyardOrders: [
        order({ endsAt: 3000 }),
        order({ id: 2, quantity: 2, unitDurationMs: null, startedAt: null, endsAt: null }),
      ],
    });
    expect(ordersEndAt(planet, 1)).toBe(3000 + 2 * 1_440_000);
  });
});

describe('maxLabel', () => {
  it('shows Max N, or Max 0 with when one unit is affordable', () => {
    expect(maxLabel(shipView(satellite, snapshot(), 1, stock), snapshot(), stock)).toBe('Max 50');
    // One satellite needs 2000 Crystal; 10 short at 15/h is 40m.
    const poor = { ...stock, crystal: 1990 };
    const v = shipView(satellite, snapshot(), 1, poor);
    expect(maxLabel(v, snapshot(), poor)).toBe('Max 0 · 1 in 40m');
    const noCrystal = snapshot({ ratesPerHour: { alloy: 30, crystal: 0, deuterium: 0 } });
    expect(maxLabel(v, noCrystal, poor)).toBe('Max 0');
  });
});

describe('orderProgress', () => {
  it('counts finished units live and times the next one', () => {
    const o = order({ quantity: 4, unitDurationMs: 1000, startedAt: 0 });
    expect(orderProgress(o, 2500)).toEqual({ completed: 2, nextUnitInMs: 500, fraction: 0.625 });
  });

  it('never runs past the last unit, and is idle while waiting', () => {
    expect(orderProgress(order({ quantity: 3 }), 10_000)).toMatchObject({
      completed: 3,
      nextUnitInMs: 0,
      fraction: 1,
    });
    expect(
      orderProgress(order({ completed: 0, startedAt: null, unitDurationMs: null }), 5000),
    ).toEqual({ completed: 0, nextUnitInMs: null, fraction: 0 });
  });
});

describe('waitingOrderSec', () => {
  it('estimates a waiting Order as quantity × the per-unit time at current levels', () => {
    const o = order({ ship: 'hauler', quantity: 20, startedAt: null, unitDurationMs: null });
    // Hauler at Shipyard 1: 2880 s per unit.
    expect(waitingOrderSec(o, snapshot(), 1)).toBe(20 * 2880);
  });
});

describe('fleetStrength', () => {
  it("sums the design's Combat / Cargo / Support and leaves Solar Satellites out", () => {
    const ships = {
      interceptor: 240,
      corvette: 60,
      cruiser: 32,
      dreadnought: 6,
      hauler: 85,
      freighter: 24,
      salvager: 12,
      'scout-drone': 40,
      'solar-satellite': 500,
    };
    expect(fleetStrength(ships)).toEqual({ total: 499, combat: 338, cargo: 121, support: 40 });
  });
});

describe('labels', () => {
  it('counts Orders and gives Energy per satellite for the temperature', () => {
    expect(ordersLabel(1)).toBe('1 ORDER');
    expect(ordersLabel(2)).toBe('2 ORDERS');
    // Tmax 70 → Tavg 50 → floor(210 / 6) = 35.
    expect(satelliteEnergyEach(snapshot())).toBe(35);
  });
});
