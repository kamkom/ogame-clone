import { describe, expect, it } from 'vitest';
import { technologyDef } from '#shared/catalog.ts';
import type { PlanetSnapshot, ResearchEntryView } from './api.ts';
import { nodeStatus, queueAction, researchProgress, techView } from './research.ts';

function snapshot(overrides: Partial<PlanetSnapshot> = {}): PlanetSnapshot {
  return {
    id: 1,
    name: 'Homeworld',
    coordinates: { galaxy: 1, system: 1, position: 4 },
    coordinatesLabel: '[1:1:4]',
    temperature: { min: 30, max: 70 },
    fields: { used: 0, inProgress: 0, max: 163 },
    diameterKm: 12800,
    resources: { alloy: 10_000, crystal: 10_000, deuterium: 10_000 },
    serverNow: 0,
    lastUpdatedAt: 0,
    ratesPerHour: { alloy: 30, crystal: 15, deuterium: 0 },
    storageCapacity: { alloy: 10000, crystal: 10000, deuterium: 10000 },
    energy: { produced: 0, consumed: 0, productionFactor: 1 },
    structures: { 'research-lab': 1 },
    buildSlots: [null, null],
    technologies: {},
    researchQueue: [],
    ships: {},
    shipyardOrders: [],
    nextEventAt: null,
    ...overrides,
  };
}

function entry(overrides: Partial<ResearchEntryView>): ResearchEntryView {
  return {
    id: 1,
    technology: 'energy-theory',
    targetLevel: 1,
    cost: { alloy: 0, crystal: 800, deuterium: 400 },
    startedAt: 0,
    endsAt: 1_440_000,
    waitingOnLab: false,
    ...overrides,
  };
}

const energy = technologyDef('energy-theory')!;
const lasers = technologyDef('photon-lasers')!;
const rich = { alloy: 10_000, crystal: 10_000, deuterium: 10_000 };

describe('techView', () => {
  it('prices and times the next level from the current Lab level', () => {
    const v = techView(energy, snapshot(), 1, rich);
    expect(v.level).toBe(0);
    expect(v.targetLevel).toBe(1);
    expect(v.cost).toEqual({ alloy: 0, crystal: 800, deuterium: 400 });
    expect(v.durationSec).toBe(1440);
    expect(v.unlocked).toBe(true);
    expect(v.affordable).toBe(true);
  });

  it('plans past queued levels and marks the running entry', () => {
    const planet = snapshot({
      researchQueue: [entry({}), entry({ id: 2, targetLevel: 2, startedAt: null, endsAt: null })],
    });
    const v = techView(energy, planet, 1, rich);
    expect(v.targetLevel).toBe(3);
    expect(v.active?.id).toBe(1);
    expect(v.queuedLevels).toEqual([1, 2]);
  });

  it('is locked until requirements are met, counting queued Technology levels', () => {
    expect(techView(lasers, snapshot(), 1, rich).unlocked).toBe(false);
    const planet = snapshot({
      researchQueue: [entry({}), entry({ id: 2, targetLevel: 2, startedAt: null, endsAt: null })],
    });
    expect(techView(lasers, planet, 1, rich).unlocked).toBe(true);
  });

  it('is not affordable when any Resource is short', () => {
    const v = techView(energy, snapshot(), 1, { alloy: 0, crystal: 799, deuterium: 400 });
    expect(v.affordable).toBe(false);
  });
});

describe('nodeStatus', () => {
  it('reads "Researching → N" for the running Technology', () => {
    const planet = snapshot({ researchQueue: [entry({})] });
    expect(nodeStatus(techView(energy, planet, 1, rich))).toEqual({
      text: 'Researching → 1',
      tone: 'busy',
    });
  });

  it('reads "Locked" for an unbuilt Technology whose requirements are unmet', () => {
    expect(nodeStatus(techView(lasers, snapshot(), 1, rich))).toEqual({
      text: 'Locked',
      tone: 'locked',
    });
  });

  it('reads "Level L" otherwise', () => {
    const planet = snapshot({ technologies: { 'energy-theory': 4 } });
    expect(nodeStatus(techView(energy, planet, 1, rich))).toEqual({
      text: 'Level 4',
      tone: 'idle',
    });
  });
});

describe('researchProgress', () => {
  it('is the elapsed share of the running entry, clamped to 0–1', () => {
    const e = entry({ startedAt: 1000, endsAt: 2000 });
    expect(researchProgress(e, 1500)).toBe(0.5);
    expect(researchProgress(e, 500)).toBe(0);
    expect(researchProgress(e, 5000)).toBe(1);
  });

  it('is 0 for a waiting entry', () => {
    expect(researchProgress(entry({ startedAt: null, endsAt: null }), 1500)).toBe(0);
  });
});

describe('queueAction', () => {
  it('starts Research when the queue is empty', () => {
    const planet = snapshot();
    expect(queueAction(planet, techView(energy, planet, 1, rich))).toEqual({
      label: 'START RESEARCH',
      enabled: true,
    });
  });

  it('queues after the last entry otherwise', () => {
    const planet = snapshot({ researchQueue: [entry({})] });
    expect(queueAction(planet, techView(energy, planet, 1, rich))).toEqual({
      label: 'QUEUE AFTER ENERGY THEORY',
      enabled: true,
    });
  });

  it('is disabled when the queue is full, locked or unaffordable', () => {
    const full = snapshot({
      researchQueue: [1, 2, 3, 4, 5].map((id) => entry({ id, targetLevel: id })),
    });
    expect(queueAction(full, techView(energy, full, 1, rich))).toEqual({
      label: 'QUEUE FULL · 5 OF 5',
      enabled: false,
    });
    const planet = snapshot();
    expect(queueAction(planet, techView(lasers, planet, 1, rich))).toEqual({
      label: 'LOCKED',
      enabled: false,
    });
    const poor = techView(energy, planet, 1, { alloy: 0, crystal: 0, deuterium: 0 });
    expect(queueAction(planet, poor)).toEqual({ label: 'NOT ENOUGH RESOURCES', enabled: false });
  });
});
