import type { DatabaseSync } from 'node:sqlite';
import { advance, type EconomyState, type Structures } from '#shared/engine.ts';
import { tx } from '../db/tx.ts';
import { getPlanetByPlayer, type PlanetRow } from './repo.ts';

// How catalog keys in the database map onto the engine's state fields. These are the keys the
// later Structures/Research slices will write; nothing writes them yet, so a home Planet reads
// back all-zero and only base income accrues.
const STRUCTURE_KEYS: Record<keyof Structures, string> = {
  alloyMine: 'alloyExtractor',
  crystalMine: 'crystalRefinery',
  deuteriumSynth: 'deuteriumSynthesizer',
  solarPlant: 'solarArray',
  fusionReactor: 'fusionReactor',
  alloyStorage: 'alloyStorage',
  crystalStorage: 'crystalStorage',
  deuteriumStorage: 'deuteriumTank',
};
const ENERGY_TECH_KEY = 'energyTechnology';
const PLASMA_TECH_KEY = 'plasmaTechnology';
const SOLAR_SATELLITE_KEY = 'solarSatellite';

// `Tmax = Tavg + 20` on every OGame Planet, so `Tavg = Tmax − 20` (rules reference §6.1).
const TAVG_OFFSET = 20;

/** Read a Planet's full economy state from the database. */
export function readEconomyState(db: DatabaseSync, planet: PlanetRow): EconomyState {
  const structureLevels = new Map(
    (
      db
        .prepare(`SELECT structure_key, level FROM planet_structures WHERE planet_id = ?`)
        .all(planet.id) as { structure_key: string; level: number }[]
    ).map((row) => [row.structure_key, row.level]),
  );
  const techLevels = new Map(
    (
      db
        .prepare(`SELECT technology_key, level FROM player_technologies WHERE player_id = ?`)
        .all(planet.player_id) as { technology_key: string; level: number }[]
    ).map((row) => [row.technology_key, row.level]),
  );
  const satellites =
    ((
      db
        .prepare(`SELECT count FROM planet_ships WHERE planet_id = ? AND ship_key = ?`)
        .get(planet.id, SOLAR_SATELLITE_KEY) as { count: number } | undefined
    )?.count ?? 0) | 0;

  const structures = Object.fromEntries(
    Object.entries(STRUCTURE_KEYS).map(([field, key]) => [field, structureLevels.get(key) ?? 0]),
  ) as unknown as Structures;

  return {
    resources: { alloy: planet.alloy, crystal: planet.crystal, deuterium: planet.deuterium },
    lastUpdatedAt: planet.resources_updated_at,
    structures,
    solarSatellites: satellites,
    energyTech: techLevels.get(ENERGY_TECH_KEY) ?? 0,
    plasmaTech: techLevels.get(PLASMA_TECH_KEY) ?? 0,
    position: planet.position,
    tavg: planet.tmax - TAVG_OFFSET,
  };
}

/**
 * Catch a Planet up to `now` and persist it, returning the updated row. Must run inside a
 * transaction; `loadAdvancedPlanet` provides one.
 */
export function advanceAndPersist(
  db: DatabaseSync,
  planet: PlanetRow,
  now: number,
  speed: number,
): PlanetRow {
  const advanced = advance(readEconomyState(db, planet), now, speed);
  const { alloy, crystal, deuterium } = advanced.resources;
  db.prepare(
    `UPDATE planets SET alloy = ?, crystal = ?, deuterium = ?, resources_updated_at = ? WHERE id = ?`,
  ).run(alloy, crystal, deuterium, now, planet.id);
  return { ...planet, alloy, crystal, deuterium, resources_updated_at: now };
}

/**
 * Load a Player's Planet, advance it to `now` and save the catch-up — all in one `tx`, per
 * ADR 0001. Read-only requests call this too, so every view of a Planet is current. Null when
 * the Player has no Planet.
 */
export function loadAdvancedPlanet(
  db: DatabaseSync,
  playerId: number,
  now: number,
  speed: number,
): PlanetRow | null {
  return tx(db, (db) => {
    const planet = getPlanetByPlayer(db, playerId);
    if (!planet) return null;
    return advanceAndPersist(db, planet, now, speed);
  });
}
