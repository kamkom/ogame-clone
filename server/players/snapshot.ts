import { SHIPS, STRUCTURES, TECHNOLOGIES } from '#shared/catalog.ts';
import { formatCoordinates } from '#shared/coords.ts';
import { nextEventAt, orderEndsAt, orderNextUnitAt } from '#shared/engine.ts';
import {
  allLevels,
  economyOf,
  planetFields,
  playerProfile,
  type PlayerState,
} from '#shared/player.ts';
import type { BuildSlotSnapshot, PlanetSnapshot } from '#shared/snapshot.ts';
import { HOME_DIAMETER_KM, tminFor } from './repo.ts';

export type { PlanetSnapshot } from '#shared/snapshot.ts';

export interface SnapshotContext {
  serverNow: number;
  speed: number;
}

/**
 * Build the spec-shaped snapshot from a saved Player state (every queue entry has its id) that has
 * already been advanced to `ctx.serverNow`.
 */
export function buildPlanetSnapshot(state: PlayerState, ctx: SnapshotContext): PlanetSnapshot {
  const { planet } = state;
  const coordinates = { galaxy: planet.galaxy, system: planet.system, position: planet.position };
  const economy = economyOf(state);
  const profile = playerProfile(state, ctx.speed);

  const buildSlots: (BuildSlotSnapshot | null)[] = [null, null];
  for (const bs of state.buildSlots) {
    buildSlots[bs.slot - 1] = {
      slot: bs.slot,
      structure: bs.structure,
      targetLevel: bs.targetLevel,
      cost: bs.cost,
      startedAt: bs.startedAt,
      endsAt: bs.endsAt,
    };
  }

  return {
    serverNow: ctx.serverNow,
    lastUpdatedAt: state.lastUpdatedAt,
    universeSpeed: ctx.speed,
    planet: {
      id: planet.id,
      name: planet.name,
      coordinates,
      coordinatesLabel: formatCoordinates(coordinates),
      tmin: tminFor(planet.tmax),
      tmax: planet.tmax,
      fields: planetFields(state),
      diameterKm: HOME_DIAMETER_KM,
    },
    resources: { ...state.resources },
    ratesPerHour: profile.rates,
    storageCapacity: profile.storage,
    energy: profile.energy,
    structures: allLevels(state.structures, STRUCTURES),
    buildSlots,
    technologies: allLevels(state.technologies, TECHNOLOGIES),
    // Only a Lab upgrade holds the head back, so a head that hasn't started is waiting on the Lab.
    researchQueue: state.researchQueue.map((e, i) => ({
      id: e.id!,
      technology: e.technology,
      targetLevel: e.targetLevel,
      cost: e.cost,
      startedAt: e.startedAt,
      endsAt: e.endsAt,
      waitingOnLab: i === 0 && e.startedAt === null,
    })),
    ships: allLevels(state.ships, SHIPS),
    shipyardOrders: state.shipyardOrders.map((o, i) => {
      const engine = economy.shipyardOrders![i]!;
      return {
        id: o.id!,
        ship: o.ship,
        quantity: o.quantity,
        completed: o.completed,
        cost: o.cost,
        unitDurationMs: o.unitDurationMs,
        startedAt: o.startedAt,
        nextUnitAt: orderNextUnitAt(engine),
        endsAt: orderEndsAt(engine),
      };
    }),
    nextEventAt: nextEventAt(economy, ctx.speed, ctx.serverNow),
  };
}
