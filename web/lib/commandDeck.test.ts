import { describe, expect, it } from 'vitest';
import { STRUCTURES } from '#shared/catalog.ts';
import type { BuildSlotView, PlanetSnapshot } from './api.ts';
import {
  deckStructureRows,
  dockSubtitle,
  fleetDock,
  slotProgress,
  slotRows,
} from './commandDeck.ts';

function snapshot(overrides: Partial<PlanetSnapshot> = {}): PlanetSnapshot {
  return {
    id: 1,
    name: 'Homeworld',
    coordinates: { galaxy: 1, system: 1, position: 4 },
    coordinatesLabel: '[1:1:4]',
    temperature: { min: 30, max: 70 },
    fields: { used: 0, inProgress: 0, max: 163 },
    diameterKm: 12800,
    resources: { alloy: 500, crystal: 500, deuterium: 0 },
    serverNow: 0,
    lastUpdatedAt: 0,
    ratesPerHour: { alloy: 30, crystal: 15, deuterium: 0 },
    storageCapacity: { alloy: 10_000, crystal: 10_000, deuterium: 10_000 },
    energy: { produced: 0, consumed: 0, productionFactor: 1 },
    structures: {},
    buildSlots: [null, null],
    technologies: {},
    researchQueue: [],
    ships: {},
    shipyardOrders: [],
    nextEventAt: null,
    ...overrides,
  };
}

function slot(overrides: Partial<BuildSlotView> = {}): BuildSlotView {
  return {
    slot: 1,
    structure: 'alloy-extractor',
    targetLevel: 1,
    cost: { alloy: 60, crystal: 15, deuterium: 0 },
    startedAt: 0,
    endsAt: 60_000,
    ...overrides,
  };
}

describe('fleetDock', () => {
  it('lists the 8 ships in design order and leaves Solar Satellites out', () => {
    const dock = fleetDock({ interceptor: 3, hauler: 2, 'solar-satellite': 40 });
    expect(dock.tiles.map((t) => t.def.key)).toEqual([
      'interceptor',
      'corvette',
      'cruiser',
      'dreadnought',
      'hauler',
      'freighter',
      'scout-drone',
      'salvager',
    ]);
    expect(dock.tiles[0]!.count).toBe(3);
    expect(dock.tiles[1]!.count).toBe(0);
    expect(dock.docked).toBe(5);
  });
});

describe('dockSubtitle', () => {
  it('reads "N ships docked"', () => {
    expect(dockSubtitle(0)).toBe('0 ships docked');
    expect(dockSubtitle(1)).toBe('1 ship docked');
    expect(dockSubtitle(1234)).toBe('1,234 ships docked');
  });
});

describe('slotRows', () => {
  it('gives a free row per empty Build Slot', () => {
    expect(slotRows(snapshot())).toEqual([
      { slot: 1, busy: null },
      { slot: 2, busy: null },
    ]);
  });

  it('keeps a busy slot in its own position', () => {
    const s = slot({ slot: 2 });
    expect(slotRows(snapshot({ buildSlots: [null, s] }))).toEqual([
      { slot: 1, busy: null },
      { slot: 2, busy: s },
    ]);
  });
});

describe('slotProgress', () => {
  it('runs from 0 at the start to 1 at the end, clamped', () => {
    const s = slot({ startedAt: 10_000, endsAt: 20_000 });
    expect(slotProgress(s, 5_000)).toBe(0);
    expect(slotProgress(s, 12_500)).toBe(0.25);
    expect(slotProgress(s, 30_000)).toBe(1);
  });
});

describe('deckStructureRows', () => {
  it('locks the Terraformer until 1000 Energy is produced', () => {
    const ready = {
      structures: { 'nanite-foundry': 1 },
      technologies: { 'energy-theory': 12 },
      resources: { alloy: 1e6, crystal: 1e6, deuterium: 1e6 },
    };
    const short = deckStructureRows(
      snapshot({ ...ready, energy: { produced: 999, consumed: 0, productionFactor: 1 } }),
      1,
      0,
    ).find((r) => r.def.key === 'terraformer')!;
    expect(short.state).toBe('energy');
    expect(short.energyRequired).toBe(1000);
    expect(short.action).toEqual({ enabled: false, label: 'ENERGY', icon: 'lock' });
    expect(short.reason).toBe('NEEDS 1,000 ENERGY · 999 PRODUCED');

    const met = deckStructureRows(
      snapshot({ ...ready, energy: { produced: 1000, consumed: 0, productionFactor: 1 } }),
      1,
      0,
    ).find((r) => r.def.key === 'terraformer')!;
    expect(met.action.enabled).toBe(true);
  });

  it('lists all 13 Structures in design order with their levels', () => {
    const rows = deckStructureRows(snapshot({ structures: { 'solar-array': 4 } }), 1, 0);
    expect(rows.map((r) => r.def.key)).toEqual(STRUCTURES.map((d) => d.key));
    expect(rows).toHaveLength(13);
    expect(rows.find((r) => r.def.key === 'solar-array')!.level).toBe(4);
  });

  it('shows a new Player level 0 and BUILD for what they can afford', () => {
    const rows = deckStructureRows(snapshot(), 1, 0);
    const extractor = rows.find((r) => r.def.key === 'alloy-extractor')!;
    expect(extractor.level).toBe(0);
    expect(extractor.action).toEqual({ enabled: true, label: 'BUILD', icon: null });
  });

  it('gives each disabled button its reason or countdown', () => {
    const rows = deckStructureRows(
      snapshot({
        buildSlots: [
          slot({ slot: 1, structure: 'alloy-extractor', endsAt: 90_000 }),
          slot({ slot: 2, structure: 'crystal-refinery', endsAt: 42_000 }),
        ],
      }),
      1,
      0,
    );
    const by = (key: string) => rows.find((r) => r.def.key === key)!.action;
    // Building: the countdown to its own finish.
    expect(by('alloy-extractor')).toEqual({ enabled: false, label: '00:01:30', icon: 'clock' });
    // Both slots busy: the countdown to the first free slot.
    expect(by('solar-array')).toEqual({ enabled: false, label: '00:00:42', icon: 'clock' });
    // Requirements unmet: LOCKED.
    expect(by('fusion-reactor')).toEqual({ enabled: false, label: 'LOCKED', icon: 'lock' });
  });

  it('fits a short row\'s button to "SHORT" and keeps what is short and when in its reason', () => {
    const rows = deckStructureRows(
      snapshot({ resources: { alloy: 0, crystal: 0, deuterium: 0 } }),
      1,
      0,
    );
    const row = rows.find((r) => r.def.key === 'alloy-extractor')!;
    expect(row.action).toEqual({ enabled: false, label: 'SHORT', icon: 'lock' });
    expect(row.reason).toBe('SHORT: ALLOY · CRYSTAL · AFFORDABLE IN 2h 00m');
  });

  it('keeps the full label as the reason otherwise', () => {
    const row = deckStructureRows(snapshot(), 1, 0).find((r) => r.def.key === 'fusion-reactor')!;
    expect(row.reason).toBe('LOCKED');
  });
});
