import { describe, expect, it } from 'vitest';
import { STRUCTURES } from '#shared/catalog.ts';
import type { PlanetSnapshot } from './api.ts';
import { structureEffects } from './structureEffect.ts';

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

const effects = (key: string, planet = snapshot(), speed = 1) =>
  structureEffects(key, planet, speed);

describe('structureEffects', () => {
  it('gives every catalog Structure at least one effect line', () => {
    for (const def of STRUCTURES) expect(effects(def.key).length).toBeGreaterThan(0);
  });

  it('shows mine output now and at the next level, then its Energy use', () => {
    const planet = snapshot({ structures: { 'alloy-extractor': 1 } });
    expect(effects('alloy-extractor', planet)).toEqual([
      { label: 'Alloy/h', current: '+33', next: '+72' },
      { label: 'Energy use', current: '11', next: '25' },
    ]);
  });

  it('applies the position bonus, Plasma Technology and Universe Speed to mine output', () => {
    const planet = snapshot({
      planet: { ...snapshot().planet, coordinates: { galaxy: 1, system: 1, position: 8 } },
    });
    // 30·1·1.1·1.35 = 44.55 → 44; at speed 2, 89.1 → 89.
    expect(effects('alloy-extractor', planet)[0]).toMatchObject({ current: '+0', next: '+44' });
    expect(effects('alloy-extractor', planet, 2)[0]).toMatchObject({ next: '+89' });
    const plasma = snapshot({ technologies: { 'plasma-containment': 10 } });
    // 20·1·1.1·1.066 = 23.45 → 23.
    expect(effects('crystal-refinery', plasma)[0]).toMatchObject({ next: '+23' });
  });

  it('uses the Planet temperature for the Deuterium Synthesizer', () => {
    // Tavg = 70 − 20 = 50: 10·1·1.1·(1.36 − 0.2) = 12.76 → 12.
    expect(effects('deuterium-synthesizer')[0]).toEqual({
      label: 'Deuterium/h',
      current: '+0',
      next: '+12',
    });
  });

  it('shows Energy for the Solar Array and Energy plus burn for the Fusion Reactor', () => {
    expect(effects('solar-array')).toEqual([{ label: 'Energy', current: '+0', next: '+22' }]);
    const planet = snapshot({ technologies: { 'energy-theory': 3 } });
    // 30·1·1.08 = 32.4 → 32; burn ceil(10·1·1.1) = 11.
    expect(effects('fusion-reactor', planet)).toEqual([
      { label: 'Energy', current: '+0', next: '+32' },
      { label: 'Deuterium burn/h', current: '0', next: '11' },
    ]);
  });

  it('shows Storage Capacity for the three stores', () => {
    const planet = snapshot({ structures: { 'crystal-vault': 1 } });
    expect(effects('alloy-depot')).toEqual([
      { label: 'Alloy capacity', current: '10,000', next: '20,000' },
    ]);
    expect(effects('crystal-vault', planet)[0]).toMatchObject({
      label: 'Crystal capacity',
      current: '20,000',
    });
    expect(effects('deuterium-tank')[0]!.label).toBe('Deuterium capacity');
  });

  it('shows the build-time cuts and the Research speed', () => {
    const planet = snapshot({ structures: { 'robotics-works': 1 } });
    expect(effects('robotics-works', planet)).toEqual([
      { label: 'Structure build time', current: '−50%', next: '−67%' },
    ]);
    expect(effects('orbital-shipyard')).toEqual([
      { label: 'Ship build time', current: '−0%', next: '−50%' },
    ]);
    expect(effects('research-lab')).toEqual([
      { label: 'Research speed', current: '×1', next: '×2' },
    ]);
    expect(effects('nanite-foundry')).toEqual([
      { label: 'Build and ship times', current: '÷1', next: '÷2' },
    ]);
  });

  it('shows the Terraformer max Fields', () => {
    const planet = snapshot({ structures: { terraformer: 1 } });
    expect(effects('terraformer', planet)).toEqual([
      { label: 'Max Fields', current: '168', next: '174' },
    ]);
  });
});
