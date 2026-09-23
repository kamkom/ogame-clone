import type { DatabaseSync } from 'node:sqlite';
import {
  advance,
  type BuildSlot,
  type EconomyState,
  type ResearchEntry,
  type Structures,
  type TechField,
} from '#shared/engine.ts';
import { tx } from '../db/tx.ts';
import { getPlanetByPlayer, type PlanetRow, structureLevels, technologyLevels } from './repo.ts';

// How catalog keys (shared/catalog.ts) map onto the engine's state fields. The eight production
// Structures plus the Research Lab (whose level fixes Research durations); the other four (Robotics
// Works, Orbital Shipyard, Nanite Foundry, Terraformer) have no effect on the engine, so a Build
// Slot for them carries a null `field`.
const STRUCTURE_KEYS: Record<keyof Structures, string> = {
  alloyMine: 'alloy-extractor',
  crystalMine: 'crystal-refinery',
  deuteriumSynth: 'deuterium-synthesizer',
  solarPlant: 'solar-array',
  fusionReactor: 'fusion-reactor',
  alloyStorage: 'alloy-depot',
  crystalStorage: 'crystal-vault',
  deuteriumStorage: 'deuterium-tank',
  researchLab: 'research-lab',
};
// The engine `field` for a catalog key, or null when the key doesn't affect production.
const FIELD_BY_KEY = new Map<string, keyof Structures>(
  (Object.entries(STRUCTURE_KEYS) as [keyof Structures, string][]).map(([field, key]) => [
    key,
    field,
  ]),
);
// The two Technologies that change production; every other Technology carries a null `field`.
const TECH_KEYS: Record<TechField, string> = {
  energyTech: 'energy-theory',
  plasmaTech: 'plasma-containment',
};
const TECH_FIELD_BY_KEY = new Map<string, TechField>(
  (Object.entries(TECH_KEYS) as [TechField, string][]).map(([field, key]) => [key, field]),
);
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

/** A Player's Research Queue in order, head first, as engine state. */
export function readResearchQueue(db: DatabaseSync, playerId: number): ResearchEntry[] {
  const rows = db
    .prepare(
      `SELECT id, technology_key, target_level, cost_alloy, cost_crystal, started_at, ends_at
         FROM research_queue WHERE player_id = ? ORDER BY seq`,
    )
    .all(playerId) as {
    id: number;
    technology_key: string;
    target_level: number;
    cost_alloy: number;
    cost_crystal: number;
    started_at: number | null;
    ends_at: number | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    technologyKey: r.technology_key,
    field: TECH_FIELD_BY_KEY.get(r.technology_key) ?? null,
    targetLevel: r.target_level,
    cost: { alloy: r.cost_alloy, crystal: r.cost_crystal },
    startedAt: r.started_at,
    endsAt: r.ends_at,
  }));
}

// `Tmax = Tavg + 20` on every OGame Planet, so `Tavg = Tmax − 20` (rules reference §6.1).
const TAVG_OFFSET = 20;

/** Read a Planet's full economy state from the database. */
export function readEconomyState(db: DatabaseSync, planet: PlanetRow): EconomyState {
  const levels = structureLevels(db, planet.id);
  const techs = technologyLevels(db, planet.player_id);
  const satellites =
    ((
      db
        .prepare(`SELECT count FROM planet_ships WHERE planet_id = ? AND ship_key = ?`)
        .get(planet.id, SOLAR_SATELLITE_KEY) as { count: number } | undefined
    )?.count ?? 0) | 0;

  const structures = Object.fromEntries(
    Object.entries(STRUCTURE_KEYS).map(([field, key]) => [field, levels[key] ?? 0]),
  ) as unknown as Structures;

  return {
    resources: { alloy: planet.alloy, crystal: planet.crystal, deuterium: planet.deuterium },
    lastUpdatedAt: planet.resources_updated_at,
    structures,
    solarSatellites: satellites,
    energyTech: techs[TECH_KEYS.energyTech] ?? 0,
    plasmaTech: techs[TECH_KEYS.plasmaTech] ?? 0,
    position: planet.position,
    tavg: planet.tmax - TAVG_OFFSET,
    buildSlots: readBuildSlots(db, planet.id),
    researchQueue: readResearchQueue(db, planet.player_id),
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
  const before = readEconomyState(db, planet);
  const advanced = advance(before, now, speed);
  const { alloy, crystal, deuterium } = advanced.resources;
  db.prepare(
    `UPDATE planets SET alloy = ?, crystal = ?, deuterium = ?, resources_updated_at = ? WHERE id = ?`,
  ).run(alloy, crystal, deuterium, now, planet.id);
  finalizeFinishedUpgrades(db, planet.id, now);
  persistResearchQueue(db, planet.player_id, before.researchQueue ?? [], advanced);
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
 * Reconcile the stored Research Queue with the engine's: every entry `advance` finished raises its
 * Technology and leaves the queue, and every remaining entry keeps the start and end times the
 * engine fixed for it (a new head starts at the boundary where the previous one ended).
 */
function persistResearchQueue(
  db: DatabaseSync,
  playerId: number,
  before: ResearchEntry[],
  advanced: EconomyState,
): void {
  const remaining = advanced.researchQueue ?? [];
  const remainingIds = new Set(remaining.map((e) => e.id));
  for (const e of before) {
    if (remainingIds.has(e.id)) continue;
    db.prepare(
      `INSERT INTO player_technologies (player_id, technology_key, level) VALUES (?, ?, ?)
         ON CONFLICT(player_id, technology_key) DO UPDATE SET level = excluded.level`,
    ).run(playerId, e.technologyKey, e.targetLevel);
    db.prepare(`DELETE FROM research_queue WHERE id = ?`).run(e.id);
  }
  for (const e of remaining) {
    db.prepare(`UPDATE research_queue SET started_at = ?, ends_at = ? WHERE id = ?`).run(
      e.startedAt,
      e.endsAt,
      e.id,
    );
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
