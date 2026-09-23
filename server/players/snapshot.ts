import type { DatabaseSync } from 'node:sqlite';
import { formatCoordinates } from '#shared/coords.ts';
import { liveProfile, nextEventAt, orderEndsAt, orderNextUnitAt } from '#shared/engine.ts';
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

/** One occupied Build Slot in the snapshot, or null for a free slot. */
export interface BuildSlotSnapshot {
  slot: number;
  structure: string;
  targetLevel: number;
  cost: { alloy: number; crystal: number; deuterium: number };
  startedAt: number;
  endsAt: number;
}

/** One Research Queue entry in the snapshot; the times are null while it waits. */
export interface ResearchEntrySnapshot {
  id: number;
  technology: string;
  targetLevel: number;
  cost: { alloy: number; crystal: number; deuterium: number };
  startedAt: number | null;
  endsAt: number | null;
  /** True when the head waits for a Research Lab upgrade (the Lab lock lands in a later ticket). */
  waitingOnLab: boolean;
}

/** One Shipyard Order in the snapshot; the times are null while it waits behind another. */
export interface ShipyardOrderSnapshot {
  id: number;
  ship: string;
  quantity: number;
  completed: number;
  /** The total paid for the whole Order. */
  cost: { alloy: number; crystal: number; deuterium: number };
  unitDurationMs: number | null;
  startedAt: number | null;
  nextUnitAt: number | null;
  endsAt: number | null;
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
  /** Every catalog Technology's current level (0 when not researched). */
  technologies: Record<string, number>;
  /** The Research Queue in order, head first. */
  researchQueue: ResearchEntrySnapshot[];
  /** Every catalog ship's docked count (Solar Satellites included). */
  ships: Record<string, number>;
  /** The Shipyard Orders in order, head first. */
  shipyardOrders: ShipyardOrderSnapshot[];
  nextEventAt: number | null;
}

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
  return rows.map((r) => ({
    id: r.id,
    technology: r.technology_key,
    targetLevel: r.target_level,
    cost: { alloy: r.cost_alloy, crystal: r.cost_crystal, deuterium: r.cost_deuterium },
    startedAt: r.started_at,
    endsAt: r.ends_at,
    waitingOnLab: false,
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
    id: planet.id,
    name: planet.name,
    coordinates,
    coordinatesLabel: formatCoordinates(coordinates),
    temperature: { min: tminFor(planet.tmax), max: planet.tmax },
    fields: planetFields(db, planet.id),
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
    technologies: technologyLevels(db, planet.player_id),
    researchQueue: researchQueue(db, planet.player_id),
    ships: shipCounts(db, planet.id),
    shipyardOrders: shipyardOrders(db, planet.id),
    nextEventAt: nextEventAt(economy, ctx.speed, ctx.serverNow),
  };
}
