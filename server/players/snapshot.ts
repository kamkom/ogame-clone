import type { DatabaseSync } from 'node:sqlite';
import { formatCoordinates } from '#shared/coords.ts';
import { liveProfile, nextEventAt } from '#shared/engine.ts';
import { readEconomyState } from './economy.ts';
import { HOME_DIAMETER_KM, HOME_FIELDS, type PlanetRow, tminFor } from './repo.ts';

// The /api/planet response shape. Resources are the exact stock at `lastUpdatedAt`; the client
// interpolates forward from there using `ratesPerHour`, capped at `storageCapacity`.
export interface PlanetSnapshot {
  id: number;
  name: string;
  coordinates: { galaxy: number; system: number; position: number };
  coordinatesLabel: string;
  temperature: { min: number; max: number };
  fields: { used: number; max: number };
  diameterKm: number;
  resources: { alloy: number; crystal: number; deuterium: number };
  serverNow: number;
  lastUpdatedAt: number;
  ratesPerHour: { alloy: number; crystal: number; deuterium: number };
  storageCapacity: { alloy: number; crystal: number; deuterium: number };
  energy: { produced: number; consumed: number; productionFactor: number };
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
  return {
    id: planet.id,
    name: planet.name,
    coordinates,
    coordinatesLabel: formatCoordinates(coordinates),
    temperature: { min: tminFor(planet.tmax), max: planet.tmax },
    fields: { used: usedFields(db, planet.id), max: HOME_FIELDS },
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
    nextEventAt: nextEventAt(economy, ctx.speed, ctx.serverNow),
  };
}
