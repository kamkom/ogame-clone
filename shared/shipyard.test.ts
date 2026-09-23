import { describe, expect, it } from 'vitest';
import { catalogName, SHIPS, shipDef } from './catalog.ts';
import {
  maxAffordableUnits,
  orderCost,
  SHIP_ORDER_MAX_UNITS,
  shipRequirementStatus,
  unlockText,
} from './shipyard.ts';

describe('ship catalog', () => {
  it("lists the design's 8 ships in order, then the Solar Satellite", () => {
    expect(SHIPS.map((s) => s.name)).toEqual([
      'Interceptor',
      'Corvette',
      'Cruiser',
      'Dreadnought',
      'Hauler',
      'Freighter',
      'Scout Drone',
      'Salvager',
      'Solar Satellite',
    ]);
    expect(shipDef('solar-satellite')!.role).toBe('Energy');
    expect(catalogName('scout-drone')).toBe('Scout Drone');
  });

  it("carries OGame's stats (rules reference §10.1)", () => {
    // The Cruiser matches the design's detail panel exactly.
    expect(shipDef('cruiser')).toMatchObject({
      ogame: 'Cruiser',
      role: 'Line ship',
      cost: { alloy: 20_000, crystal: 7000, deuterium: 2000 },
      stats: { attack: 400, shields: 50, hull: 27_000, speed: 15_000, cargo: 800, fuel: 300 },
    });
    expect(shipDef('solar-satellite')!.cost).toEqual({ alloy: 0, crystal: 2000, deuterium: 500 });
  });

  it('reads Dreadnought\'s unlock text as "Orbital Shipyard 7 · Warp Drive 4"', () => {
    expect(unlockText(shipDef('dreadnought')!.requires)).toBe('Orbital Shipyard 7 · Warp Drive 4');
  });
});

describe('ship requirements', () => {
  it('counts finished Structure and Technology levels', () => {
    const status = shipRequirementStatus(shipDef('interceptor')!, {
      structures: { 'orbital-shipyard': 1 },
      technologies: {},
    });
    expect(status).toEqual([
      { key: 'orbital-shipyard', name: 'Orbital Shipyard', have: 1, need: 1, met: true },
      { key: 'combustion-drive', name: 'Combustion Drive', have: 0, need: 1, met: false },
    ]);
  });
});

describe('order cost', () => {
  it('is the unit price × quantity', () => {
    expect(orderCost(shipDef('cruiser')!, 10)).toEqual({
      alloy: 200_000,
      crystal: 70_000,
      deuterium: 20_000,
    });
  });
});

describe('Max N (largest affordable quantity)', () => {
  const cruiser = shipDef('cruiser')!.cost;
  it('is the minimum over each cost of floor(stock / cost)', () => {
    // design-catalog-mapping: 1,248,390 Alloy / 612,044 Crystal / 208,715 Deut → 62, Alloy-bound.
    expect(
      maxAffordableUnits(cruiser, { alloy: 1_248_390, crystal: 612_044, deuterium: 208_715 }),
    ).toBe(62);
    expect(maxAffordableUnits(cruiser, { alloy: 19_999, crystal: 1e6, deuterium: 1e6 })).toBe(0);
    // Fractional stock is floored first.
    expect(maxAffordableUnits(cruiser, { alloy: 39_999.9, crystal: 1e6, deuterium: 1e6 })).toBe(1);
  });

  it('ignores a zero cost and caps at 99,999', () => {
    const satellite = shipDef('solar-satellite')!.cost; // no Alloy
    expect(maxAffordableUnits(satellite, { alloy: 0, crystal: 4000, deuterium: 5000 })).toBe(2);
    expect(maxAffordableUnits(satellite, { alloy: 0, crystal: 1e12, deuterium: 1e12 })).toBe(
      SHIP_ORDER_MAX_UNITS,
    );
    expect(SHIP_ORDER_MAX_UNITS).toBe(99_999);
  });
});
