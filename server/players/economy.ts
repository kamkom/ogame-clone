import type { DatabaseSync } from 'node:sqlite';
import { advance, type BuildSlot, type EconomyState, type Structures } from '#shared/engine.ts';
import { tx } from '../db/tx.ts';
import { getPlanetByPlayer, type PlanetRow } from './repo.ts';

// How catalog keys (shared/catalog.ts) map onto the engine's production-state fields. Only these
// eight Structures affect production; the other five (Robotics Works, Orbital Shipyard, Research
// Lab, Nanite Foundry, Terraformer) have no economy effect, so a Build Slot for them carries a
// null `field`.
const STRUCTURE_KEYS: Record<keyof Structures, string> = {
  alloyMine: 'alloy-extractor',
  crystalMine: 'crystal-refinery',
  deuteriumSynth: 'deuterium-synthesizer',
  solarPlant: 'solar-array',
  fusionReactor: 'fusion-reactor',
  alloyStorage: 'alloy-depot',
  crystalStorage: 'crystal-vault',
  deuteriumStorage: 'deuterium-tank',
};
// The engine `field` for a catalog key, or null when the key doesn't affect production.
const FIELD_BY_KEY = new Map<string, keyof Structures>(
  (Object.entries(STRUCTURE_KEYS) as [keyof Structures, string][]).map(([field, key]) => [
    key,
    field,
  ]),
);
const ENERGY_TECH_KEY = 'energyTechnology';
const PLASMA_TECH_KEY = 'plasmaTechnology';
const SOLAR_SATELLITE_KEY = 'solarSatellite';

/** The Build Slots currently occupied on a Planet, as engine state. */
export function readBuildSlots(db: DatabaseSync, planetId: number): BuildSlot[] {
  const rows = db
    .prepare(
      `SELECT slot, structure_key, target_level, ends_at FROM build_slots WHERE planet_id = ?`,
    )
    .all(planetId) as {
    slot: number;
    structure_key: string;
    target_level: number;
    ends_at: number;
  }[];
  return rows.map((r) => ({
    slot: r.slot,
    structureKey: r.structure_key,
    field: FIELD_BY_KEY.get(r.structure_key) ?? null,
    targetLevel: r.target_level,
    endsAt: r.ends_at,
  }));
}

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
    buildSlots: readBuildSlots(db, planet.id),
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
  finalizeFinishedUpgrades(db, planet.id, now);
  return { ...planet, alloy, crystal, deuterium, resources_updated_at: now };
}

/**
 * Apply every Build Slot upgrade whose `ends_at` has passed: raise the Structure level and free the
 * slot. The resource integration in `advance` already accounted for these level changes at their
 * boundaries, so this only reconciles the stored levels and slots.
 */
function finalizeFinishedUpgrades(db: DatabaseSync, planetId: number, now: number): void {
  const finished = db
    .prepare(
      `SELECT slot, structure_key, target_level FROM build_slots WHERE planet_id = ? AND ends_at <= ?`,
    )
    .all(planetId, now) as { slot: number; structure_key: string; target_level: number }[];
  for (const f of finished) {
    db.prepare(
      `INSERT INTO planet_structures (planet_id, structure_key, level) VALUES (?, ?, ?)
         ON CONFLICT(planet_id, structure_key) DO UPDATE SET level = excluded.level`,
    ).run(planetId, f.structure_key, f.target_level);
    db.prepare(`DELETE FROM build_slots WHERE planet_id = ? AND slot = ?`).run(planetId, f.slot);
  }
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
