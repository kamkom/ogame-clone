import type { DatabaseSync } from 'node:sqlite';
import { formatCoordinates } from '#shared/coords.ts';
import { liveProfile, nextEventAt, orderEndsAt, orderNextUnitAt } from '#shared/engine.ts';
import type {
  BuildSlotSnapshot,
  PlanetSnapshot,
  ResearchEntrySnapshot,
  ShipyardOrderSnapshot,
} from '#shared/snapshot.ts';
import { readEconomyState, readShipyardOrders } from './economy.ts';
import {
  HOME_DIAMETER_KM,
  type PlanetRow,
  shipCounts,
  structureLevels,
  technologyLevels,
  tminFor,
} from './repo.ts';
import { planetFields } from './structures.ts';

export type { PlanetSnapshot } from '#shared/snapshot.ts';

export interface SnapshotContext {
  serverNow: number;
  speed: number;
}

/** The Player's Research Queue in order, head first. */
function researchQueue(db: DatabaseSync, playerId: number): ResearchEntrySnapshot[] {
  const rows = db
    .prepare(
      `SELECT id, technology_key, target_level, cost_alloy, cost_crystal, cost_deuterium, started_at, ends_at
         FROM research_queue WHERE player_id = ? ORDER BY seq`,
    )
    .all(playerId) as {
    id: number;
    technology_key: string;
    target_level: number;
    cost_alloy: number;
    cost_crystal: number;
    cost_deuterium: number;
    started_at: number | null;
    ends_at: number | null;
  }[];
  // Only a Lab upgrade holds the head back, so a head that hasn't started is waiting on the Lab.
  return rows.map((r, i) => ({
    id: r.id,
    technology: r.technology_key,
    targetLevel: r.target_level,
    cost: { alloy: r.cost_alloy, crystal: r.cost_crystal, deuterium: r.cost_deuterium },
    startedAt: r.started_at,
    endsAt: r.ends_at,
    waitingOnLab: i === 0 && r.started_at === null,
  }));
}

/** The Planet's Shipyard Orders in order, head first, with the paid totals and unit times. */
function shipyardOrders(db: DatabaseSync, planetId: number): ShipyardOrderSnapshot[] {
  const paid = db
    .prepare(
      `SELECT id, cost_alloy, cost_crystal, cost_deuterium FROM shipyard_orders WHERE planet_id = ?`,
    )
    .all(planetId) as {
    id: number;
    cost_alloy: number;
    cost_crystal: number;
    cost_deuterium: number;
  }[];
  const costById = new Map(
    paid.map((r) => [
      r.id,
      { alloy: r.cost_alloy, crystal: r.cost_crystal, deuterium: r.cost_deuterium },
    ]),
  );
  return readShipyardOrders(db, planetId).map((o) => ({
    id: o.id,
    ship: o.shipKey,
    quantity: o.quantity,
    completed: o.completed,
    cost: costById.get(o.id)!,
    unitDurationMs: o.unitDurationMs,
    startedAt: o.startedAt,
    nextUnitAt: orderNextUnitAt(o),
    endsAt: orderEndsAt(o),
  }));
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
    serverNow: ctx.serverNow,
    lastUpdatedAt: planet.resources_updated_at,
    universeSpeed: ctx.speed,
    planet: {
      id: planet.id,
      name: planet.name,
      coordinates,
      coordinatesLabel: formatCoordinates(coordinates),
      tmin: tminFor(planet.tmax),
      tmax: planet.tmax,
      fields: planetFields(db, planet.id),
      diameterKm: HOME_DIAMETER_KM,
    },
    resources: {
      alloy: planet.alloy,
      crystal: planet.crystal,
      deuterium: planet.deuterium,
    },
    ratesPerHour: profile.rates,
    storageCapacity: profile.storage,
    energy: profile.energy,
    structures: structureLevels(db, planet.id),
    buildSlots: slots,
    technologies: technologyLevels(db, planet.player_id),
    researchQueue: researchQueue(db, planet.player_id),
    ships: shipCounts(db, planet.id),
    shipyardOrders: shipyardOrders(db, planet.id),
    nextEventAt: nextEventAt(economy, ctx.speed, ctx.serverNow),
  };
}
