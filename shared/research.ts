// Research rules shared by the server commands and the Research screen, so the UI's button states
// can never disagree with what the server accepts (spec stories 53–55).

import {
  catalogName,
  type Requirement,
  type StructureCost,
  type TechnologyDef,
  technologyDef,
} from './catalog.ts';
import { levelCost } from './economy.ts';

/** A Research Queue entry, as far as these rules care. */
export interface QueuedResearch {
  technology: string;
  targetLevel: number;
}

/** Current Structure and Technology levels by catalog key (a missing key means level 0). */
export interface Levels {
  structures: Record<string, number>;
  technologies: Record<string, number>;
}

export interface RequirementStatus {
  key: string;
  name: string;
  have: number;
  need: number;
  met: boolean;
}

/** Cost of researching `level` (§2), with Astrophysics' rounding to the nearest 100. */
export function technologyCost(def: TechnologyDef, level: number): StructureCost {
  const one = (base: number): number => {
    const cost = levelCost(base, def.factor, level);
    return def.roundCostTo ? Math.round(cost / def.roundCostTo) * def.roundCostTo : cost;
  };
  return {
    alloy: one(def.baseCost.alloy),
    crystal: one(def.baseCost.crystal),
    deuterium: one(def.baseCost.deuterium),
  };
}

/** The highest level of `technology` the queue will reach, or `current` when none is queued. */
function plannedLevel(technology: string, current: number, queue: QueuedResearch[]): number {
  return queue.reduce(
    (max, e) => (e.technology === technology ? Math.max(max, e.targetLevel) : max),
    current,
  );
}

/**
 * The level a new entry for `technology` would research: one past the current level and past every
 * queued entry of it, so queuing the same Technology twice gives consecutive levels (story 54).
 */
export function researchTargetLevel(
  technology: string,
  current: number,
  queue: QueuedResearch[],
): number {
  return plannedLevel(technology, current, queue) + 1;
}

/**
 * Each requirement with what the Player has and needs. A Technology requirement counts levels
 * already in the queue; a Structure requirement counts only built levels (story 55).
 */
export function requirementStatus(
  requires: Requirement[],
  levels: Levels,
  queue: QueuedResearch[],
): RequirementStatus[] {
  return requires.map(({ key, level: need }) => {
    const have = technologyDef(key)
      ? plannedLevel(key, levels.technologies[key] ?? 0, queue)
      : (levels.structures[key] ?? 0);
    return { key, name: catalogName(key), have, need, met: have >= need };
  });
}
