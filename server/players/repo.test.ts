import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { open } from '../db/open.ts';
import { hashToken } from '../auth/tokens.ts';
import { lookupSession } from '../auth/sessions.ts';
import { MAX_POSITION, MIN_POSITION } from '../coords.ts';
import {
  getPlanetByPlayer,
  getPlayer,
  registerPlayer,
  STARTING_ALLOY,
  STARTING_CRYSTAL,
  STARTING_DEUTERIUM,
  tminFor,
} from './repo.ts';
import { buildPlanetSnapshot } from './snapshot.ts';

/** rng that replays a fixed list, cycling so it never runs dry. */
function cycle(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe('registerPlayer', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = open(':memory:');
  });

  it('inserts player, planet and session in one go', () => {
    const { playerId, planetId } = registerPlayer(db, {
      username: 'Vega',
      password: 'password1',
      now: 1000,
      rng: Math.random,
      galaxies: 9,
      systems: 499,
      tokenHash: hashToken('tok'),
    });

    expect(getPlayer(db, playerId)).toEqual({ id: playerId, username: 'Vega' });
    expect(lookupSession(db, hashToken('tok'), 1000)).toBe(playerId);

    const planet = getPlanetByPlayer(db, playerId)!;
    expect(planet.id).toBe(planetId);
    expect(planet.name).toBe('Homeworld');
    expect(planet.alloy).toBe(STARTING_ALLOY);
    expect(planet.crystal).toBe(STARTING_CRYSTAL);
    expect(planet.deuterium).toBe(STARTING_DEUTERIUM);
    expect(planet.position).toBeGreaterThanOrEqual(MIN_POSITION);
    expect(planet.position).toBeLessThanOrEqual(MAX_POSITION);
    expect(tminFor(planet.tmax)).toBe(planet.tmax - 40);
  });

  it('redraws Coordinates on a collision and still lands at 4..12', () => {
    // First player takes the coords the rng produces first.
    const first = registerPlayer(db, {
      username: 'Alpha',
      password: 'password1',
      now: 1,
      // galaxy 0→1, system 0→1, position 0→4, tmax 0→lo
      rng: cycle([0, 0, 0, 0]),
      galaxies: 9,
      systems: 499,
      tokenHash: hashToken('a'),
    });
    const p1 = getPlanetByPlayer(db, first.playerId)!;

    // Second player's rng yields the SAME coords first (collision), then a fresh draw.
    const rng = cycle([
      0,
      0,
      0,
      0, // collides with p1
      0.5,
      0.5,
      0.9,
      0.5, // redraw → different coords
    ]);
    const second = registerPlayer(db, {
      username: 'Beta',
      password: 'password1',
      now: 2,
      rng,
      galaxies: 9,
      systems: 499,
      tokenHash: hashToken('b'),
    });
    const p2 = getPlanetByPlayer(db, second.playerId)!;

    expect(`${p2.galaxy}:${p2.system}:${p2.position}`).not.toBe(
      `${p1.galaxy}:${p1.system}:${p1.position}`,
    );
    expect(p2.position).toBeGreaterThanOrEqual(MIN_POSITION);
    expect(p2.position).toBeLessThanOrEqual(MAX_POSITION);
    expect(tminFor(p2.tmax)).toBe(p2.tmax - 40);
  });

  it('builds a spec-shaped snapshot', () => {
    const { playerId } = registerPlayer(db, {
      username: 'Vega',
      password: 'password1',
      now: 1,
      rng: cycle([0, 0, 0, 0]),
      galaxies: 9,
      systems: 499,
      tokenHash: hashToken('t'),
    });
    const snap = buildPlanetSnapshot(db, getPlanetByPlayer(db, playerId)!, {
      serverNow: 1,
      speed: 1,
    });
    expect(snap.name).toBe('Homeworld');
    expect(snap.coordinatesLabel).toBe('[1:1:4]');
    expect(snap.fields).toEqual({ used: 0, max: 163 });
    expect(snap.diameterKm).toBe(12800);
    expect(snap.resources).toEqual({ alloy: 500, crystal: 500, deuterium: 0 });
    expect(snap.temperature.min).toBe(snap.temperature.max - 40);
    expect(snap.ratesPerHour).toEqual({ alloy: 30, crystal: 15, deuterium: 0 });
  });
});
