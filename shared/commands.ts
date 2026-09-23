// The game commands (spec #18, "Game engine"). Each one validates against a Player state that has
// already been advanced to `now` and either returns the changed state or a typed rejection code.
// They are pure: no I/O, and the input state is never mutated.

import {
  requirementStatus as structureRequirements,
  shipDef,
  structureDef,
  technologyDef,
} from './catalog.ts';
import {
  energyRequiredAt,
  levelCost,
  researchDurationSec,
  type ResourceAmounts,
  shipUnitDurationSec,
  structureDurationSec,
} from './economy.ts';
import {
  levelOf,
  planetFields,
  playerProfile,
  type PlayerResearchEntry,
  type PlayerState,
} from './player.ts';
import {
  cancelCascade,
  RESEARCH_QUEUE_MAX,
  requirementStatus,
  researchTargetLevel,
  technologyCost,
  technologyEnergyRequired,
} from './research.ts';
import {
  isValidQuantity,
  orderCost,
  SHIPYARD_LOCK_STRUCTURES,
  SHIPYARD_ORDERS_MAX,
  shipRequirementStatus,
} from './shipyard.ts';

export type CommandResult<E extends string> = { ok: true; state: PlayerState } | { error: E };

/** Why an upgrade could not start. */
export type UpgradeRejection =
  | 'not_found'
  | 'already_in_progress'
  | 'slots_full'
  | 'locked_research_active'
  | 'locked_shipyard_busy'
  | 'requirements_not_met'
  | 'fields_full'
  | 'insufficient_energy'
  | 'cannot_afford';

/** Why Research could not be queued. */
export type ResearchRejection =
  | 'not_found'
  | 'research_queue_full'
  | 'requirements_not_met'
  | 'insufficient_energy'
  | 'cannot_afford';

/** Why a Shipyard Order was refused. */
export type ShipyardRejection =
  | 'not_found'
  | 'invalid_quantity'
  | 'locked_shipyard_upgrading'
  | 'shipyard_orders_full'
  | 'requirements_not_met'
  | 'cannot_afford';

const SLOT_COUNT = 2;

/** Whether the floored stock covers `cost`. */
function canAfford(stock: ResourceAmounts, cost: ResourceAmounts): boolean {
  return (
    Math.floor(stock.alloy) >= cost.alloy &&
    Math.floor(stock.crystal) >= cost.crystal &&
    Math.floor(stock.deuterium) >= cost.deuterium
  );
}

/** `stock` plus `sign` × `amount`, per Resource. */
function add(stock: ResourceAmounts, amount: ResourceAmounts, sign: 1 | -1): ResourceAmounts {
  return {
    alloy: stock.alloy + sign * amount.alloy,
    crystal: stock.crystal + sign * amount.crystal,
    deuterium: stock.deuterium + sign * amount.deuterium,
  };
}

/** Whether a Research Lab upgrade holds the Research head (queue rule 14). */
function labUpgrading(state: PlayerState): boolean {
  return state.buildSlots.some((bs) => bs.structure === 'research-lab');
}

/**
 * Start the Research head at `now` if it waits and the Lab isn't upgrading, its duration fixed
 * from the current Lab level. While the Lab upgrades, the engine starts it at the Lab's boundary.
 */
function startWaitingHead(state: PlayerState, now: number, speed: number): PlayerState {
  const head = state.researchQueue[0];
  if (!head || head.startedAt !== null || labUpgrading(state)) return state;
  const lab = levelOf(state.structures, 'research-lab');
  const endsAt = now + researchDurationSec(head.cost.alloy, head.cost.crystal, lab, speed) * 1000;
  return {
    ...state,
    researchQueue: [{ ...head, startedAt: now, endsAt }, ...state.researchQueue.slice(1)],
  };
}

/**
 * Start upgrading `key` into a free Build Slot, paying the level's cost now and fixing its
 * duration from the current Robotics Works and Nanite Foundry levels (spec stories 39, 41).
 */
export function startUpgrade(
  state: PlayerState,
  key: string,
  now: number,
  speed: number,
): CommandResult<UpgradeRejection> {
  const def = structureDef(key);
  if (!def) return { error: 'not_found' };

  const slots = state.buildSlots;
  if (slots.some((s) => s.structure === key)) return { error: 'already_in_progress' };
  if (slots.length >= SLOT_COUNT) return { error: 'slots_full' };
  // Research Lab lock: the Lab can't start upgrading while Research is running (queue rule 14).
  const researching = state.researchQueue.some((e) => e.startedAt !== null);
  if (key === 'research-lab' && researching) return { error: 'locked_research_active' };
  // Shipyard lock: the Orbital Shipyard and Nanite Foundry wait until every Order has finished.
  if (SHIPYARD_LOCK_STRUCTURES.includes(key) && state.shipyardOrders.length > 0) {
    return { error: 'locked_shipyard_busy' };
  }

  // Requirements use finished levels only; a level still in a Build Slot doesn't count.
  const current = (k: string) =>
    structureDef(k) ? levelOf(state.structures, k) : levelOf(state.technologies, k);
  if (structureRequirements(def, current).some((r) => !r.met)) {
    return { error: 'requirements_not_met' };
  }

  const fields = planetFields(state);
  if (fields.used + fields.inProgress >= fields.max) return { error: 'fields_full' };

  const targetLevel = current(key) + 1;
  // An Energy requirement (Terraformer) is checked against the Energy produced, not spent.
  const energy = playerProfile(state, speed).energy.produced;
  if (energy < energyRequiredAt(def, targetLevel)) return { error: 'insufficient_energy' };
  const cost = {
    alloy: levelCost(def.baseCost.alloy, def.factor, targetLevel),
    crystal: levelCost(def.baseCost.crystal, def.factor, targetLevel),
    deuterium: levelCost(def.baseCost.deuterium, def.factor, targetLevel),
  };
  if (!canAfford(state.resources, cost)) return { error: 'cannot_afford' };

  const durationSec = structureDurationSec(
    cost.alloy,
    cost.crystal,
    targetLevel,
    current('robotics-works'),
    current('nanite-foundry'),
    speed,
    def.isNaniteFoundry ?? false,
  );
  const slot = slots.some((s) => s.slot === 1) ? 2 : 1;
  return {
    ok: true,
    state: {
      ...state,
      resources: add(state.resources, cost, -1),
      buildSlots: [
        ...slots,
        {
          slot,
          structure: key,
          targetLevel,
          cost,
          startedAt: now,
          endsAt: now + durationSec * 1000,
        },
      ],
    },
  };
}

/**
 * Cancel the upgrade in Build Slot `slot`: refund exactly what was paid and free the slot, so its
 * Field returns (spec story 47). Cancelling a Research Lab upgrade lets a waiting head start now.
 */
export function cancelUpgrade(
  state: PlayerState,
  slot: number,
  now: number,
  speed: number,
): CommandResult<'not_found'> {
  const running = state.buildSlots.find((bs) => bs.slot === slot);
  if (!running) return { error: 'not_found' };
  const cancelled: PlayerState = {
    ...state,
    resources: add(state.resources, running.cost, 1),
    buildSlots: state.buildSlots.filter((bs) => bs !== running),
  };
  return { ok: true, state: startWaitingHead(cancelled, now, speed) };
}

/**
 * Queue Research of `key` (spec stories 53–56), paid now, one level past the current level and
 * any queued entries of it. A Technology requirement may be met by an earlier entry; a Structure
 * requirement must already be built. It starts at once when it is the head (unless the Lab is
 * upgrading); otherwise it waits.
 */
export function enqueueResearch(
  state: PlayerState,
  key: string,
  now: number,
  speed: number,
): CommandResult<ResearchRejection> {
  const def = technologyDef(key);
  if (!def) return { error: 'not_found' };
  if (state.researchQueue.length >= RESEARCH_QUEUE_MAX) return { error: 'research_queue_full' };

  const levels = { structures: state.structures, technologies: state.technologies };
  const queue = state.researchQueue;
  if (!requirementStatus(def.requires, levels, queue).every((r) => r.met)) {
    return { error: 'requirements_not_met' };
  }

  const targetLevel = researchTargetLevel(key, levelOf(state.technologies, key), queue);
  // An Energy requirement (Graviton Lance) is checked against the Energy produced, not spent.
  const energy = playerProfile(state, speed).energy.produced;
  if (energy < technologyEnergyRequired(def, targetLevel)) return { error: 'insufficient_energy' };

  const cost = technologyCost(def, targetLevel);
  if (!canAfford(state.resources, cost)) return { error: 'cannot_afford' };

  const entry: PlayerResearchEntry = {
    id: null,
    technology: key,
    targetLevel,
    cost: { alloy: cost.alloy, crystal: cost.crystal, deuterium: cost.deuterium },
    startedAt: null,
    endsAt: null,
  };
  const queued: PlayerState = {
    ...state,
    resources: add(state.resources, cost, -1),
    researchQueue: [...queue, entry],
  };
  return { ok: true, state: startWaitingHead(queued, now, speed) };
}

/**
 * Cancel Research entry `entryId`, running or waiting, and every waiting entry that depended on it
 * (queue rule 10, spec story 58), refunding each in full. If the head went, the new head starts now.
 */
export function cancelResearch(
  state: PlayerState,
  entryId: number,
  now: number,
  speed: number,
): CommandResult<'not_found'> {
  if (!state.researchQueue.some((e) => e.id === entryId)) return { error: 'not_found' };
  // Entries not yet saved carry null ids; none of them can be the one named here.
  const saved = state.researchQueue.map((e, i) => ({ ...e, id: e.id ?? -1 - i }));
  const levels = { structures: state.structures, technologies: state.technologies };
  const gone = cancelCascade(saved, entryId, levels);

  let resources = state.resources;
  const kept: PlayerResearchEntry[] = [];
  saved.forEach((e, i) => {
    if (gone.has(e.id)) resources = add(resources, e.cost, 1);
    else kept.push(state.researchQueue[i]!);
  });
  return {
    ok: true,
    state: startWaitingHead({ ...state, resources, researchQueue: kept }, now, speed),
  };
}

/**
 * Place an Order of `quantity` × `key` (spec stories 67–71), paid in full now. Requirements count
 * finished levels only. When no Order is ahead of it, it starts at once, its per-unit time fixed
 * from the current Orbital Shipyard and Nanite Foundry levels; otherwise it waits.
 */
export function placeShipyardOrder(
  state: PlayerState,
  key: string,
  quantity: number,
  now: number,
  speed: number,
): CommandResult<ShipyardRejection> {
  const def = shipDef(key);
  if (!def) return { error: 'not_found' };
  if (!isValidQuantity(quantity)) return { error: 'invalid_quantity' };
  // Shipyard lock: no new Orders while the Orbital Shipyard or Nanite Foundry upgrades.
  if (state.buildSlots.some((bs) => SHIPYARD_LOCK_STRUCTURES.includes(bs.structure))) {
    return { error: 'locked_shipyard_upgrading' };
  }
  const placed = state.shipyardOrders.length;
  if (placed >= SHIPYARD_ORDERS_MAX) return { error: 'shipyard_orders_full' };

  const levels = { structures: state.structures, technologies: state.technologies };
  if (!shipRequirementStatus(def, levels).every((r) => r.met)) {
    return { error: 'requirements_not_met' };
  }
  const cost = orderCost(def, quantity);
  if (!canAfford(state.resources, cost)) return { error: 'cannot_afford' };

  const head = placed === 0;
  const unitDurationMs = head
    ? shipUnitDurationSec(
        def.cost.alloy,
        def.cost.crystal,
        levelOf(state.structures, 'orbital-shipyard'),
        levelOf(state.structures, 'nanite-foundry'),
        speed,
      ) * 1000
    : null;
  return {
    ok: true,
    state: {
      ...state,
      resources: add(state.resources, cost, -1),
      shipyardOrders: [
        ...state.shipyardOrders,
        {
          id: null,
          ship: key,
          quantity,
          completed: 0,
          cost,
          unitDurationMs,
          startedAt: head ? now : null,
        },
      ],
    },
  };
}

/** Rename the Planet. `name` has already passed shared/planetName.ts's rules (a 400, not a 409). */
export function renamePlanet(state: PlayerState, name: string): CommandResult<never> {
  return { ok: true, state: { ...state, planet: { ...state.planet, name } } };
}
