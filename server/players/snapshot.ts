import type { DatabaseSync } from 'node:sqlite';
import { formatCoordinates } from '#shared/coords.ts';
import { HOME_DIAMETER_KM, HOME_FIELDS, type PlanetRow, tminFor } from './repo.ts';

// The /api/planet response shape. Resources are static until Live Resources (a later slice)
// integrates production; everything else is fixed for a home Planet.
export interface PlanetSnapshot {
  id: number;
  name: string;
  coordinates: { galaxy: number; system: number; position: number };
  coordinatesLabel: string;
  temperature: { min: number; max: number };
  fields: { used: number; max: number };
  diameterKm: number;
  resources: { alloy: number; crystal: number; deuterium: number };
}

/** Fields in use = the sum of finished Structure levels on the Planet. */
function usedFields(db: DatabaseSync, planetId: number): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(level), 0) AS used FROM planet_structures WHERE planet_id = ?`)
    .get(planetId) as { used: number };
  return Number(row.used);
}

/** Build the spec-shaped snapshot for a Planet row. */
export function buildPlanetSnapshot(db: DatabaseSync, planet: PlanetRow): PlanetSnapshot {
  const coordinates = {
    galaxy: planet.galaxy,
    system: planet.system,
    position: planet.position,
  };
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
  };
}
