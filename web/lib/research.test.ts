import { describe, expect, it } from 'vitest';
import { technologyDef } from '#shared/catalog.ts';
import type { PlanetSnapshot, ResearchEntryView } from './api.ts';
import { researchDurationSec } from '#shared/economy.ts';
import {
  entryDurationSec,
  labLockEndsAt,
  nodeStatus,
  queueAction,
  queueToggleLabel,
  researchProgress,
  techView,
  waitingHeadStartsAt,
} from './research.ts';

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

  it('reads "Waiting → N" in amber for a head held by a Lab upgrade', () => {
    const planet = snapshot({
      researchQueue: [entry({ startedAt: null, endsAt: null, waitingOnLab: true })],
    });
    expect(nodeStatus(techView(energy, planet, 1, rich))).toEqual({
      text: 'Waiting → 1',
      tone: 'waiting',
    });
  });

  it('reads "Queued → 6, 7" for levels waiting behind the head', () => {
    const planet = snapshot({
      technologies: { 'energy-theory': 5 },
      researchQueue: [
        entry({ technology: 'computation' }),
        entry({ id: 2, targetLevel: 6, startedAt: null, endsAt: null }),
        entry({ id: 3, targetLevel: 7, startedAt: null, endsAt: null }),
      ],
    });
    expect(nodeStatus(techView(energy, planet, 1, rich))).toEqual({
      text: 'Queued → 6, 7',
      tone: 'queued',
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
      kind: 'ready',
      label: 'START RESEARCH',
      enabled: true,
    });
  });

  it('queues after the last entry otherwise', () => {
    const planet = snapshot({ researchQueue: [entry({})] });
    expect(queueAction(planet, techView(energy, planet, 1, rich))).toEqual({
      kind: 'ready',
      label: 'QUEUE AFTER ENERGY THEORY',
      enabled: true,
    });
  });

  it('is disabled when the queue is full, locked or unaffordable', () => {
    const full = snapshot({
      researchQueue: [1, 2, 3, 4, 5].map((id) => entry({ id, targetLevel: id })),
    });
    expect(queueAction(full, techView(energy, full, 1, rich))).toEqual({
      kind: 'full',
      label: 'QUEUE FULL · 5 OF 5',
      enabled: false,
    });
    const planet = snapshot();
    expect(queueAction(planet, techView(lasers, planet, 1, rich))).toMatchObject({
      kind: 'locked',
      label: 'LOCKED',
      enabled: false,
    });
  });

  it('says when an unaffordable entry becomes affordable (B+C, paid at enqueue)', () => {
    // 799 Crystal of 800 at +15/h: one Crystal away, 240 s.
    const planet = snapshot();
    const poor = techView(energy, planet, 1, { alloy: 0, crystal: 799, deuterium: 400 });
    expect(poor.checks.find((c) => c.resource === 'crystal')).toMatchObject({ met: false });
    expect(queueAction(planet, poor)).toEqual({
      kind: 'short',
      label: 'AFFORDABLE IN 4m',
      enabled: false,
    });
  });

  it('refuses Graviton Lance below its Energy capacity, and queues it for free above', () => {
    const graviton = technologyDef('graviton-lance')!;
    const lab12 = { 'research-lab': 12 };
    const weak = snapshot({ structures: lab12 });
    const view = techView(graviton, weak, 1, rich);
    expect(view.energyRequired).toBe(300_000);
    expect(queueAction(weak, view)).toEqual({
      kind: 'energy',
      label: 'NEEDS 300,000 ENERGY',
      enabled: false,
    });
    const strong = snapshot({
      structures: lab12,
      energy: { produced: 300_000, consumed: 0, productionFactor: 1 },
    });
    expect(queueAction(strong, techView(graviton, strong, 1, rich))).toMatchObject({
      kind: 'ready',
      enabled: true,
    });
  });
});

describe('queueToggleLabel', () => {
  it('counts the waiting entries and the queue against its cap', () => {
    const queue = [1, 2, 3, 4, 5].map((id) => entry({ id }));
    expect(queueToggleLabel(queue)).toBe('+ 4 queued · 5 of 5');
    expect(queueToggleLabel(queue.slice(0, 2))).toBe('+ 1 queued · 2 of 5');
  });
});

describe('waitingHeadStartsAt', () => {
  it("is the Lab upgrade's endsAt while the head waits on it, null otherwise", () => {
    const slot = {
      slot: 1,
      structure: 'research-lab',
      targetLevel: 2,
      cost: { alloy: 400, crystal: 800, deuterium: 400 },
      startedAt: 0,
      endsAt: 9000,
    };
    const waiting = snapshot({
      buildSlots: [slot, null],
      researchQueue: [entry({ startedAt: null, endsAt: null, waitingOnLab: true })],
    });
    expect(waitingHeadStartsAt(waiting)).toBe(9000);
    expect(waitingHeadStartsAt(snapshot({ researchQueue: [entry({})] }))).toBeNull();
  });
});

describe('entryDurationSec', () => {
  it('times an entry at the Lab level it will start with', () => {
    const e = entry({ cost: { alloy: 0, crystal: 1600, deuterium: 800 } });
    expect(entryDurationSec(e, snapshot(), 1)).toBe(researchDurationSec(0, 1600, 1, 1));
    const upgrading = snapshot({
      buildSlots: [
        {
          slot: 1,
          structure: 'research-lab',
          targetLevel: 2,
          cost: { alloy: 400, crystal: 800, deuterium: 400 },
          startedAt: 0,
          endsAt: 9000,
        },
        null,
      ],
    });
    expect(entryDurationSec(e, upgrading, 1)).toBe(researchDurationSec(0, 1600, 2, 1));
  });
});

describe('labLockEndsAt', () => {
  it('is null with no Research running', () => {
    expect(labLockEndsAt(snapshot(), 1)).toBeNull();
  });

  it('is when the whole queue has run: the head, then each waiting entry at this Lab level', () => {
    const planet = snapshot({
      researchQueue: [
        entry({}),
        entry({
          id: 2,
          targetLevel: 2,
          cost: { alloy: 0, crystal: 1600, deuterium: 800 },
          startedAt: null,
          endsAt: null,
        }),
      ],
    });
    expect(labLockEndsAt(planet, 1)).toBe(1_440_000 + 2_880_000);
  });
});
