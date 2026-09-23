// Shipyard rules shared by the server commands and the Shipyard screen, so the quantity the UI
// offers and the requirements it shows can never disagree with what the server accepts
// (spec stories 66–71).

import { catalogName, type Requirement, type ShipDef } from './catalog.ts';
import type { ResourceAmounts } from './economy.ts';
import type { Levels, RequirementStatus } from './research.ts';

/** One Order holds 1–99,999 units (rules reference §9, OGame's per-order cap). */
export const SHIP_ORDER_MAX_UNITS = 99_999;

/** At most 10 Orders per Planet (spec story 71). */
export const SHIPYARD_ORDERS_MAX = 10;

/**
 * The Structures that lock against Shipyard Orders (spec stories 49, 73): neither may start
 * upgrading while any Order exists, and no Order is accepted while either upgrades.
 */
export const SHIPYARD_LOCK_STRUCTURES: readonly string[] = ['orbital-shipyard', 'nanite-foundry'];

const RESOURCES = ['alloy', 'crystal', 'deuterium'] as const;

/** Whether `quantity` is a whole number of units an Order may hold. */
export function isValidQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= SHIP_ORDER_MAX_UNITS;
}

/** What an Order of `quantity` units costs: the unit price × quantity, paid in full up front. */
export function orderCost(def: ShipDef, quantity: number): ResourceAmounts {
  return {
    alloy: def.cost.alloy * quantity,
    crystal: def.cost.crystal * quantity,
    deuterium: def.cost.deuterium * quantity,
  };
}

/**
 * Max N: the largest quantity `stock` can pay for — the minimum over each non-zero cost of
 * `floor(stock / cost)` — capped at the per-Order maximum.
 */
export function maxAffordableUnits(unitCost: ResourceAmounts, stock: ResourceAmounts): number {
  let max = SHIP_ORDER_MAX_UNITS;
  for (const r of RESOURCES) {
    if (unitCost[r] <= 0) continue;
    max = Math.min(max, Math.floor(Math.floor(stock[r]) / unitCost[r]));
  }
  return Math.max(0, max);
}

/**
 * Each requirement of a ship with what the Planet has and needs. Only finished levels count: a
 * Structure upgrade or Research still running does not unlock a ship.
 */
export function shipRequirementStatus(def: ShipDef, levels: Levels): RequirementStatus[] {
  return def.requires.map(({ key, level: need }) => {
    const have = levels.structures[key] ?? levels.technologies[key] ?? 0;
    return { key, name: catalogName(key), have, need, met: have >= need };
  });
}

/** A ship's unlock line, e.g. "Orbital Shipyard 7 · Warp Drive 4" (spec story 77). */
export function unlockText(requires: Requirement[]): string {
  return requires.map((r) => `${catalogName(r.key)} ${r.level}`).join(' · ');
}
