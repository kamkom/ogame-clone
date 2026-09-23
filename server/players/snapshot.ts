import type { DatabaseSync } from 'node:sqlite';
import { formatCoordinates } from '#shared/coords.ts';
import { liveProfile, nextEventAt } from '#shared/engine.ts';
import { STRUCTURES } from '#shared/catalog.ts';
import { readEconomyState } from './economy.ts';
import { HOME_DIAMETER_KM, HOME_FIELDS, type PlanetRow, tminFor } from './repo.ts';

/** One occupied Build Slot in the snapshot, or null for a free slot. */
export interface BuildSlotSnapshot {
  slot: number;
  structure: string;
  targetLevel: number;
  cost: { alloy: number; crystal: number; deuterium: number };
  startedAt: number;
  endsAt: number;
}

// The /api/planet response shape. Resources are the exact stock at `lastUpdatedAt`; the client
// interpolates forward from there using `ratesPerHour`, capped at `storageCapacity`.
export interface PlanetSnapshot {
  id: number;
  name: string;
  coordinates: { galaxy: number; system: number; position: number };
  coordinatesLabel: string;
  temperature: { min: number; max: number };
  fields: { used: number; inProgress: number; max: number };
  diameterKm: number;
  resources: { alloy: number; crystal: number; deuterium: number };
  serverNow: number;
  lastUpdatedAt: number;
  ratesPerHour: { alloy: number; crystal: number; deuterium: number };
  storageCapacity: { alloy: number; crystal: number; deuterium: number };
  energy: { produced: number; consumed: number; productionFactor: number };
  /** Every catalog Structure's current level (0 when not built). */
  structures: Record<string, number>;
  /** The two Build Slots, index 0 = slot 1; null for a free slot. */
  buildSlots: (BuildSlotSnapshot | null)[];
  nextEventAt: number | null;
}

export interface SnapshotContext {
  serverNow: number;
  speed: number;
}

/** Fields in use = the sum of finished Structure levels on the Planet. */
function usedFields(db: DatabaseSync, planetId: number): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(level), 0) AS used FROM planet_structures WHERE planet_id = ?`)
    .get(planetId) as { used: number };
  return Number(row.used);
}

/** Every catalog Structure's level (0 when it has no row yet). */
function structureLevels(db: DatabaseSync, planetId: number): Record<string, number> {
  const rows = db
    .prepare(`SELECT structure_key, level FROM planet_structures WHERE planet_id = ?`)
    .all(planetId) as { structure_key: string; level: number }[];
  const stored = new Map(rows.map((r) => [r.structure_key, r.level]));
  const levels: Record<string, number> = {};
  for (const def of STRUCTURES) levels[def.key] = stored.get(def.key) ?? 0;
  return levels;
}

/** The two Build Slots, index 0 = slot 1, index 1 = slot 2; null where the slot is free. */
function buildSlots(db: DatabaseSync, planetId: number): (BuildSlotSnapshot | null)[] {
  const rows = db
    .prepare(
      `SELECT slot, structure_key, target_level, cost_alloy, cost_crystal, cost_deuterium, started_at, ends_at
         FROM build_slots WHERE planet_id = ?`,
    )
    .all(planetId) as {
    slot: number;
    structure_key: string;
    target_level: number;
    cost_alloy: number;
    cost_crystal: number;
    cost_deuterium: number;
    started_at: number;
    ends_at: number;
  }[];
  const slots: (BuildSlotSnapshot | null)[] = [null, null];
  for (const r of rows) {
    slots[r.slot - 1] = {
      slot: r.slot,
      structure: r.structure_key,
      targetLevel: r.target_level,
      cost: { alloy: r.cost_alloy, crystal: r.cost_crystal, deuterium: r.cost_deuterium },
      startedAt: r.started_at,
      endsAt: r.ends_at,
    };
  }
  return slots;
}

/**
 * Build the spec-shaped snapshot for a Planet row that has already been advanced to
 * `ctx.serverNow` (so `resources_updated_at === serverNow`).
 */
export function buildPlanetSnapshot(
  db: DatabaseSync,
  planet: PlanetRow,
  ctx: SnapshotContext,
): PlanetSnapshot {
  const coordinates = {
    galaxy: planet.galaxy,
    system: planet.system,
    position: planet.position,
  };
  const economy = readEconomyState(db, planet);
  const profile = liveProfile(economy, ctx.speed);
  const slots = buildSlots(db, planet.id);
  return {
    id: planet.id,
    name: planet.name,
    coordinates,
    coordinatesLabel: formatCoordinates(coordinates),
    temperature: { min: tminFor(planet.tmax), max: planet.tmax },
    fields: {
      used: usedFields(db, planet.id),
      inProgress: slots.filter((s) => s !== null).length,
      max: HOME_FIELDS,
    },
    diameterKm: HOME_DIAMETER_KM,
    resources: {
      alloy: planet.alloy,
      crystal: planet.crystal,
      deuterium: planet.deuterium,
    },
    serverNow: ctx.serverNow,
    lastUpdatedAt: planet.resources_updated_at,
    ratesPerHour: profile.rates,
    storageCapacity: profile.storage,
    energy: profile.energy,
    structures: structureLevels(db, planet.id),
    buildSlots: slots,
    nextEventAt: nextEventAt(economy, ctx.speed, ctx.serverNow),
  };
}
