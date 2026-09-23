import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { enqueueResearch, placeShipyardOrder, startUpgrade } from '#shared/commands.ts';
import type { PlayerState } from '#shared/player.ts';
import { open } from '../db/open.ts';
import { hashToken } from '../auth/tokens.ts';
import { registerPlayer } from './repo.ts';
import { loadPlayerState, savePlayerState } from './state.ts';

function ok(result: { ok: true; state: PlayerState } | { error: string }): PlayerState {
  if ('error' in result) throw new Error(result.error);
  return result.state;
}

describe('Player state repositories', () => {
  let db: DatabaseSync;
  let playerId: number;
  beforeEach(() => {
    db = open(':memory:');
    ({ playerId } = registerPlayer(db, {
      username: 'Vega',
      password: 'password1',
      now: 1000,
      rng: () => 0.5,
      galaxies: 9,
      systems: 499,
      tokenHash: hashToken('t'),
    }));
  });

  it('loads a new Player at level 0 with empty queues', () => {
    const state = loadPlayerState(db, playerId)!;
    expect(state.resources).toEqual({ alloy: 500, crystal: 500, deuterium: 0 });
    expect(state.lastUpdatedAt).toBe(1000);
    expect(state.structures).toEqual({});
    expect(state.buildSlots).toEqual([]);
    expect(loadPlayerState(db, 999)).toBeNull();
  });

  it('saves what the commands produced, gives new entries ids and loads it back unchanged', () => {
    const base: PlayerState = {
      ...loadPlayerState(db, playerId)!,
      planet: { ...loadPlayerState(db, playerId)!.planet, name: 'Kepler' },
      resources: { alloy: 50_000, crystal: 50_000, deuterium: 50_000 },
      structures: { 'research-lab': 1, 'robotics-works': 2, 'orbital-shipyard': 1 },
      technologies: { 'energy-theory': 2 },
      ships: { 'solar-satellite': 3 },
    };
    let state = ok(startUpgrade(base, 'alloy-extractor', 1000, 1));
    state = ok(enqueueResearch(state, 'energy-theory', 1000, 1));
    state = ok(enqueueResearch(state, 'computation', 1000, 1));
    state = ok(placeShipyardOrder(state, 'solar-satellite', 2, 1000, 1));
    state = ok(placeShipyardOrder(state, 'solar-satellite', 1, 1000, 1));

    const saved = savePlayerState(db, state);
    expect(saved.researchQueue.every((e) => typeof e.id === 'number')).toBe(true);
    expect(saved.shipyardOrders.every((o) => typeof o.id === 'number')).toBe(true);
    expect(loadPlayerState(db, playerId)).toEqual(saved);

    // Saving again keeps the ids; dropping the head leaves the rest in order.
    const resaved = savePlayerState(db, { ...saved, researchQueue: saved.researchQueue.slice(1) });
    expect(resaved.researchQueue).toEqual(saved.researchQueue.slice(1));
    expect(loadPlayerState(db, playerId)!.researchQueue).toEqual(saved.researchQueue.slice(1));
  });
});
