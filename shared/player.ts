// The in-memory Player state the engine works on (spec #18, "Game engine"): one Planet with its
// Resources, levels by catalog key, Build Slots, Research Queue and Shipyard Orders. The server's
// repositories load and save it; `advancePlayer` and the commands (shared/commands.ts) are pure
// over it and do no I/O.

import { SHIPS, shipDef, STRUCTURES, TECHNOLOGIES } from './catalog.ts';
import { maxFields, type ResourceAmounts } from './economy.ts';
import {
  advance,
  type EconomyState,
  liveProfile,
  type ProductionProfile,
  type Structures,
  type TechField,
} from './engine.ts';

export interface PlanetFacts {
  id: number;
  playerId: number;
  name: string;
  galaxy: number;
  system: number;
  position: number;
  tmax: number;
}

/** An upgrade running in Build Slot `slot` (1 or 2), with what was paid for it. */
export interface PlayerBuildSlot {
  slot: number;
  structure: string;
  targetLevel: number;
  cost: ResourceAmounts;
  startedAt: number;
  endsAt: number;
}

/** A Research Queue entry. `id` is null until the repository saves it; times null while it waits. */
export interface PlayerResearchEntry {
  id: number | null;
  technology: string;
  targetLevel: number;
  cost: ResourceAmounts;
  startedAt: number | null;
  endsAt: number | null;
}

/** A Shipyard Order; `cost` is the total paid. `id` is null until saved; times null while it waits. */
export interface PlayerShipyardOrder {
  id: number | null;
  ship: string;
  quantity: number;
  completed: number;
  cost: ResourceAmounts;
  unitDurationMs: number | null;
  startedAt: number | null;
}

export interface PlayerState {
  planet: PlanetFacts;
  /** Current stock (fractional; floored for display and spending). */
  resources: ResourceAmounts;
  /** Epoch-ms the stock stands at. */
  lastUpdatedAt: number;
  /** Levels by catalog key; a missing key is level 0. */
  structures: Record<string, number>;
  technologies: Record<string, number>;
  /** Docked counts by catalog key; a missing key is 0. */
  ships: Record<string, number>;
  buildSlots: PlayerBuildSlot[];
  /** Head first. */
  researchQueue: PlayerResearchEntry[];
  /** Head first. */
  shipyardOrders: PlayerShipyardOrder[];
}

// How catalog keys map onto the engine's fields: the eight production Structures plus the
// Research Lab, Orbital Shipyard and Nanite Foundry (whose levels fix Research and ship
// durations). Robotics Works and the Terraformer don't touch the integrator.
const STRUCTURE_FIELDS: Record<keyof Structures, string> = {
  alloyMine: 'alloy-extractor',
  crystalMine: 'crystal-refinery',
  deuteriumSynth: 'deuterium-synthesizer',
  solarPlant: 'solar-array',
  fusionReactor: 'fusion-reactor',
  alloyStorage: 'alloy-depot',
  crystalStorage: 'crystal-vault',
  deuteriumStorage: 'deuterium-tank',
  researchLab: 'research-lab',
  orbitalShipyard: 'orbital-shipyard',
  naniteFoundry: 'nanite-foundry',
};
const FIELD_BY_STRUCTURE = new Map(
  (Object.entries(STRUCTURE_FIELDS) as [keyof Structures, string][]).map(([f, k]) => [k, f]),
);
// The two Technologies that change production.
const TECH_FIELDS: Record<TechField, string> = {
  energyTech: 'energy-theory',
  plasmaTech: 'plasma-containment',
};
const FIELD_BY_TECH = new Map(
  (Object.entries(TECH_FIELDS) as [TechField, string][]).map(([f, k]) => [k, f]),
);
export const SOLAR_SATELLITE = 'solar-satellite';

// `Tmax = Tavg + 20` on every OGame Planet, so `Tavg = Tmax − 20` (rules reference §6.1).
const TAVG_OFFSET = 20;

/** A level by catalog key, 0 when missing. */
export function levelOf(levels: Record<string, number>, key: string): number {
  return levels[key] ?? 0;
}

/** The engine's view of the Player state. Queue entries are indexed by position. */
export function economyOf(state: PlayerState): EconomyState {
  const structures = Object.fromEntries(
    Object.entries(STRUCTURE_FIELDS).map(([f, k]) => [f, levelOf(state.structures, k)]),
  ) as unknown as Structures;
  return {
    resources: { ...state.resources },
    lastUpdatedAt: state.lastUpdatedAt,
    structures,
    solarSatellites: levelOf(state.ships, SOLAR_SATELLITE),
    energyTech: levelOf(state.technologies, TECH_FIELDS.energyTech),
    plasmaTech: levelOf(state.technologies, TECH_FIELDS.plasmaTech),
    position: state.planet.position,
    tavg: state.planet.tmax - TAVG_OFFSET,
    buildSlots: state.buildSlots.map((bs) => ({
      slot: bs.slot,
      structureKey: bs.structure,
      field: FIELD_BY_STRUCTURE.get(bs.structure) ?? null,
      targetLevel: bs.targetLevel,
      endsAt: bs.endsAt,
    })),
    researchQueue: state.researchQueue.map((e, i) => ({
      id: i,
      technologyKey: e.technology,
      field: FIELD_BY_TECH.get(e.technology) ?? null,
      targetLevel: e.targetLevel,
      cost: { alloy: e.cost.alloy, crystal: e.cost.crystal },
      startedAt: e.startedAt,
      endsAt: e.endsAt,
    })),
    shipyardOrders: state.shipyardOrders.map((o, i) => {
      const unit = shipDef(o.ship)?.cost ?? { alloy: 0, crystal: 0 };
      return {
        id: i,
        shipKey: o.ship,
        solarSatellite: o.ship === SOLAR_SATELLITE,
        quantity: o.quantity,
        completed: o.completed,
        unitCost: { alloy: unit.alloy, crystal: unit.crystal },
        unitDurationMs: o.unitDurationMs,
        startedAt: o.startedAt,
      };
    }),
  };
}

/**
 * Catch the Player up to `now` (ADR 0001) and fold what finished back into the catalog-keyed
 * state: finished upgrades raise their Structure, finished Research its Technology, finished
 * units join the docked count. The engine only ever takes queue entries off the front, so the
 * entries left are the tail of each queue, in order. Returns a new state.
 */
export function advancePlayer(state: PlayerState, now: number, speed: number): PlayerState {
  const advanced = advance(economyOf(state), now, speed);

  const openSlots = new Set((advanced.buildSlots ?? []).map((bs) => bs.slot));
  const structures = { ...state.structures };
  for (const bs of state.buildSlots) {
    if (!openSlots.has(bs.slot)) structures[bs.structure] = bs.targetLevel;
  }

  const research = advanced.researchQueue ?? [];
  const researchDone = state.researchQueue.length - research.length;
  const technologies = { ...state.technologies };
  for (const e of state.researchQueue.slice(0, researchDone)) {
    technologies[e.technology] = e.targetLevel;
  }
  const researchQueue = state.researchQueue.slice(researchDone).map((e, i) => ({
    ...e,
    startedAt: research[i]!.startedAt,
    endsAt: research[i]!.endsAt,
  }));

  const orders = advanced.shipyardOrders ?? [];
  const ordersDone = state.shipyardOrders.length - orders.length;
  const ships = { ...state.ships };
  const dock = (ship: string, units: number) => {
    if (units > 0) ships[ship] = levelOf(ships, ship) + units;
  };
  for (const o of state.shipyardOrders.slice(0, ordersDone)) dock(o.ship, o.quantity - o.completed);
  const shipyardOrders = state.shipyardOrders.slice(ordersDone).map((o, i) => {
    const after = orders[i]!;
    dock(o.ship, after.completed - o.completed);
    return {
      ...o,
      completed: after.completed,
      unitDurationMs: after.unitDurationMs,
      startedAt: after.startedAt,
    };
  });

  return {
    ...state,
    resources: advanced.resources,
    lastUpdatedAt: advanced.lastUpdatedAt,
    structures,
    technologies,
    ships,
    buildSlots: state.buildSlots.filter((bs) => openSlots.has(bs.slot)),
    researchQueue,
    shipyardOrders,
  };
}

/** The live production picture at the current stock. */
export function playerProfile(state: PlayerState, speed: number): ProductionProfile {
  return liveProfile(economyOf(state), speed);
}

/** The Planet's Fields: finished levels, upgrades running in a Build Slot, and the max. */
export function planetFields(state: PlayerState): {
  used: number;
  inProgress: number;
  max: number;
} {
  const used = STRUCTURES.reduce((sum, def) => sum + levelOf(state.structures, def.key), 0);
  return {
    used,
    inProgress: state.buildSlots.length,
    max: maxFields(levelOf(state.structures, 'terraformer')),
  };
}

/** Every catalog key with its level (0 when missing), for the snapshot. */
export function allLevels(
  levels: Record<string, number>,
  catalog: typeof STRUCTURES | typeof TECHNOLOGIES | typeof SHIPS,
): Record<string, number> {
  return Object.fromEntries(catalog.map((def) => [def.key, levelOf(levels, def.key)]));
}
