import { describe, expect, it } from 'vitest';
import {
  cancelResearch,
  cancelUpgrade,
  enqueueResearch,
  placeShipyardOrder,
  renamePlanet,
  startUpgrade,
} from './commands.ts';
import { researchDurationSec, shipUnitDurationSec, structureDurationSec } from './economy.ts';
import { advancePlayer, planetFields, type PlayerState } from './player.ts';

const NOW = 1_000_000;

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  const { structures, technologies, ships, ...rest } = overrides;
  return {
    planet: { id: 1, playerId: 1, name: 'Homeworld', galaxy: 1, system: 1, position: 4, tmax: 70 },
    resources: { alloy: 500, crystal: 500, deuterium: 0 },
    lastUpdatedAt: NOW,
    buildSlots: [],
    researchQueue: [],
    shipyardOrders: [],
    ...rest,
    structures: { ...structures },
    technologies: { ...technologies },
    ships: { ...ships },
  };
}

/** The new state of a command that must succeed. */
function ok<T>(result: { ok: true; state: T } | { error: string }): T {
  if ('error' in result) throw new Error(`rejected: ${result.error}`);
  return result.state;
}

describe('startUpgrade', () => {
  it('pays the level cost and fills the first free Build Slot, leaving the input alone', () => {
    const before = player();
    const after = ok(startUpgrade(before, 'alloy-extractor', NOW, 1));
    expect(after.resources).toEqual({ alloy: 440, crystal: 485, deuterium: 0 });
    expect(after.buildSlots).toEqual([
      {
        slot: 1,
        structure: 'alloy-extractor',
        targetLevel: 1,
        cost: { alloy: 60, crystal: 15, deuterium: 0 },
        startedAt: NOW,
        endsAt: NOW + structureDurationSec(60, 15, 1, 0, 0, 1, false) * 1000,
      },
    ]);
    expect(before.buildSlots).toEqual([]);
    expect(before.resources.alloy).toBe(500);
  });

  it('names each rejection', () => {
    expect(startUpgrade(player(), 'nope', NOW, 1)).toEqual({ error: 'not_found' });
    const one = ok(startUpgrade(player(), 'alloy-extractor', NOW, 1));
    expect(startUpgrade(one, 'alloy-extractor', NOW, 1)).toEqual({
      error: 'already_in_progress',
    });
    const two = ok(startUpgrade(one, 'solar-array', NOW, 1));
    expect(startUpgrade(two, 'crystal-refinery', NOW, 1)).toEqual({ error: 'slots_full' });
    expect(
      startUpgrade(
        player({ resources: { alloy: 59, crystal: 500, deuterium: 0 } }),
        'alloy-extractor',
        NOW,
        1,
      ),
    ).toEqual({ error: 'cannot_afford' });
    expect(startUpgrade(player(), 'nanite-foundry', NOW, 1)).toEqual({
      error: 'requirements_not_met',
    });
  });

  it('locks the Research Lab while Research runs, and the Shipyard Structures while Orders exist', () => {
    const researching = player({
      structures: { 'research-lab': 1 },
      researchQueue: [
        {
          id: 1,
          technology: 'energy-theory',
          targetLevel: 1,
          cost: { alloy: 0, crystal: 800, deuterium: 400 },
          startedAt: NOW,
          endsAt: NOW + 1000,
        },
      ],
    });
    expect(startUpgrade(researching, 'research-lab', NOW, 1)).toEqual({
      error: 'locked_research_active',
    });
    const building = player({
      structures: { 'robotics-works': 2, 'orbital-shipyard': 1 },
      resources: { alloy: 10_000, crystal: 10_000, deuterium: 10_000 },
      shipyardOrders: [
        {
          id: 1,
          ship: 'solar-satellite',
          quantity: 1,
          completed: 0,
          cost: { alloy: 0, crystal: 2000, deuterium: 500 },
          unitDurationMs: 1000,
          startedAt: NOW,
        },
      ],
    });
    expect(startUpgrade(building, 'orbital-shipyard', NOW, 1)).toEqual({
      error: 'locked_shipyard_busy',
    });
  });

  it('rejects when every Field is used, counting upgrades in progress', () => {
    const full = player({ structures: { 'alloy-extractor': 163 } });
    expect(startUpgrade(full, 'solar-array', NOW, 1)).toEqual({ error: 'fields_full' });
    const nearly = player({ structures: { 'alloy-extractor': 161 } });
    const building = ok(startUpgrade(nearly, 'solar-array', NOW, 1));
    expect(planetFields(building)).toEqual({ used: 161, inProgress: 1, max: 163 });
  });
});

describe('cancelUpgrade', () => {
  it('refunds exactly what was paid and frees the slot', () => {
    const building = ok(startUpgrade(player(), 'alloy-extractor', NOW, 1));
    const cancelled = ok(cancelUpgrade(building, 1, NOW, 1));
    expect(cancelled.resources).toEqual({ alloy: 500, crystal: 500, deuterium: 0 });
    expect(cancelled.buildSlots).toEqual([]);
    expect(cancelUpgrade(cancelled, 1, NOW, 1)).toEqual({ error: 'not_found' });
  });

  it('starts a Research head that waited on the Lab upgrade', () => {
    const waiting = player({
      structures: { 'research-lab': 1 },
      buildSlots: [
        {
          slot: 2,
          structure: 'research-lab',
          targetLevel: 2,
          cost: { alloy: 400, crystal: 800, deuterium: 400 },
          startedAt: NOW - 10,
          endsAt: NOW + 10_000,
        },
      ],
      researchQueue: [
        {
          id: 7,
          technology: 'energy-theory',
          targetLevel: 1,
          cost: { alloy: 0, crystal: 800, deuterium: 400 },
          startedAt: null,
          endsAt: null,
        },
      ],
    });
    const after = ok(cancelUpgrade(waiting, 2, NOW, 1));
    expect(after.researchQueue[0]).toMatchObject({
      startedAt: NOW,
      endsAt: NOW + researchDurationSec(0, 800, 1, 1) * 1000,
    });
  });
});

describe('enqueueResearch / cancelResearch', () => {
  const lab = { 'research-lab': 1 };
  const rich = { alloy: 10_000, crystal: 10_000, deuterium: 10_000 };

  it('starts the first entry at once and queues the next one waiting', () => {
    const one = ok(
      enqueueResearch(player({ structures: lab, resources: rich }), 'energy-theory', NOW, 1),
    );
    const two = ok(enqueueResearch(one, 'energy-theory', NOW, 1));
    expect(two.researchQueue).toEqual([
      {
        id: null,
        technology: 'energy-theory',
        targetLevel: 1,
        cost: { alloy: 0, crystal: 800, deuterium: 400 },
        startedAt: NOW,
        endsAt: NOW + researchDurationSec(0, 800, 1, 1) * 1000,
      },
      {
        id: null,
        technology: 'energy-theory',
        targetLevel: 2,
        cost: { alloy: 0, crystal: 1600, deuterium: 800 },
        startedAt: null,
        endsAt: null,
      },
    ]);
    expect(two.resources).toEqual({ alloy: 10_000, crystal: 7_600, deuterium: 8_800 });
  });

  it('names the rejections', () => {
    expect(enqueueResearch(player(), 'nope', NOW, 1)).toEqual({ error: 'not_found' });
    expect(enqueueResearch(player({ resources: rich }), 'energy-theory', NOW, 1)).toEqual({
      error: 'requirements_not_met',
    });
    expect(enqueueResearch(player({ structures: lab }), 'energy-theory', NOW, 1)).toEqual({
      error: 'cannot_afford',
    });
  });

  it('cancels an entry with its dependants and refunds them', () => {
    const queued = player({
      structures: lab,
      resources: rich,
      researchQueue: [
        {
          id: 1,
          technology: 'energy-theory',
          targetLevel: 1,
          cost: { alloy: 0, crystal: 800, deuterium: 400 },
          startedAt: NOW - 5,
          endsAt: NOW + 5,
        },
        {
          id: 2,
          technology: 'energy-theory',
          targetLevel: 2,
          cost: { alloy: 0, crystal: 1600, deuterium: 800 },
          startedAt: null,
          endsAt: null,
        },
      ],
    });
    const after = ok(cancelResearch(queued, 1, NOW, 1));
    expect(after.researchQueue).toEqual([]);
    expect(after.resources).toEqual({ alloy: 10_000, crystal: 12_400, deuterium: 11_200 });
    expect(cancelResearch(after, 1, NOW, 1)).toEqual({ error: 'not_found' });
  });
});

describe('placeShipyardOrder', () => {
  const yard = { 'orbital-shipyard': 1 };
  const rich = { alloy: 10_000, crystal: 10_000, deuterium: 10_000 };

  it('pays the whole Order, starts it when nothing is ahead and queues the next', () => {
    const one = ok(
      placeShipyardOrder(
        player({ structures: yard, resources: rich }),
        'solar-satellite',
        2,
        NOW,
        1,
      ),
    );
    const two = ok(placeShipyardOrder(one, 'solar-satellite', 1, NOW, 1));
    expect(two.shipyardOrders).toEqual([
      {
        id: null,
        ship: 'solar-satellite',
        quantity: 2,
        completed: 0,
        cost: { alloy: 0, crystal: 4000, deuterium: 1000 },
        unitDurationMs: shipUnitDurationSec(0, 2000, 1, 0, 1) * 1000,
        startedAt: NOW,
      },
      {
        id: null,
        ship: 'solar-satellite',
        quantity: 1,
        completed: 0,
        cost: { alloy: 0, crystal: 2000, deuterium: 500 },
        unitDurationMs: null,
        startedAt: null,
      },
    ]);
    expect(two.resources).toEqual({ alloy: 10_000, crystal: 4_000, deuterium: 8_500 });
  });

  it('names the rejections', () => {
    const s = player({ structures: yard, resources: rich });
    expect(placeShipyardOrder(s, 'nope', 1, NOW, 1)).toEqual({ error: 'not_found' });
    expect(placeShipyardOrder(s, 'solar-satellite', 0, NOW, 1)).toEqual({
      error: 'invalid_quantity',
    });
    expect(placeShipyardOrder(player({ resources: rich }), 'solar-satellite', 1, NOW, 1)).toEqual({
      error: 'requirements_not_met',
    });
    expect(placeShipyardOrder(s, 'solar-satellite', 99, NOW, 1)).toEqual({
      error: 'cannot_afford',
    });
  });
});

describe('renamePlanet', () => {
  it('sets the name', () => {
    expect(ok(renamePlanet(player(), 'Kepler')).planet.name).toBe('Kepler');
  });
});

describe('advancePlayer', () => {
  it('lands finished upgrades, Research and ships in the catalog-keyed state', () => {
    const building = ok(startUpgrade(player(), 'alloy-extractor', NOW, 1));
    const endsAt = building.buildSlots[0]!.endsAt;
    const done = advancePlayer(building, endsAt + 1, 1);
    expect(done.structures['alloy-extractor']).toBe(1);
    expect(done.buildSlots).toEqual([]);
    expect(done.lastUpdatedAt).toBe(endsAt + 1);

    const yard = player({
      structures: { 'orbital-shipyard': 1 },
      resources: { alloy: 10_000, crystal: 10_000, deuterium: 10_000 },
    });
    const ordered = ok(placeShipyardOrder(yard, 'solar-satellite', 3, NOW, 1));
    const unit = ordered.shipyardOrders[0]!.unitDurationMs!;
    const partway = advancePlayer(ordered, NOW + 2 * unit, 1);
    expect(partway.ships['solar-satellite']).toBe(2);
    expect(partway.shipyardOrders[0]).toMatchObject({ completed: 2, startedAt: NOW });
    expect(advancePlayer(partway, NOW + 3 * unit, 1).ships['solar-satellite']).toBe(3);
  });

  it('finishes the Research head and starts the next with the Lab level', () => {
    const lab = player({
      structures: { 'research-lab': 1 },
      resources: { alloy: 10_000, crystal: 10_000, deuterium: 10_000 },
    });
    const two = ok(
      enqueueResearch(ok(enqueueResearch(lab, 'energy-theory', NOW, 1)), 'energy-theory', NOW, 1),
    );
    const headEnd = two.researchQueue[0]!.endsAt!;
    const after = advancePlayer(two, headEnd, 1);
    expect(after.technologies['energy-theory']).toBe(1);
    expect(after.researchQueue).toHaveLength(1);
    expect(after.researchQueue[0]).toMatchObject({ targetLevel: 2, startedAt: headEnd });
  });
});
