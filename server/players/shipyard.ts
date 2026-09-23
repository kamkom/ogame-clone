import type { DatabaseSync } from 'node:sqlite';
import { shipDef } from '#shared/catalog.ts';
import { shipUnitDurationSec } from '#shared/economy.ts';
import {
  isValidQuantity,
  orderCost,
  SHIPYARD_LOCK_STRUCTURES,
  SHIPYARD_ORDERS_MAX,
  shipRequirementStatus,
} from '#shared/shipyard.ts';
import { type PlanetRow, structureLevels, technologyLevels } from './repo.ts';

/** A typed reason an Order was refused. `not_found` is an unknown catalog key (404); the rest are 409s. */
export type ShipyardRejection =
  | 'not_found'
  | 'invalid_quantity'
  | 'locked_shipyard_upgrading'
  | 'shipyard_orders_full'
  | 'requirements_not_met'
  | 'cannot_afford';

export type OrderResult = { ok: true } | { error: ShipyardRejection };

/**
 * Place a Shipyard Order of `quantity` × `key` on `planet` (spec stories 67–71), paid in full now.
 * Requirements count finished levels only. When no Order is waiting ahead of it, it starts at once,
 * its per-unit time fixed from the current Orbital Shipyard and Nanite Foundry levels; otherwise it
 * waits (null times) until the engine starts it. `planet` must already be advanced to `now`. Runs
 * inside the caller's transaction.
 */
export function placeShipyardOrder(
  db: DatabaseSync,
  planet: PlanetRow,
  key: string,
  quantity: number,
  now: number,
  speed: number,
): OrderResult {
  const def = shipDef(key);
  if (!def) return { error: 'not_found' };
  if (!isValidQuantity(quantity)) return { error: 'invalid_quantity' };

  // Shipyard lock: no new Orders while the Orbital Shipyard or Nanite Foundry upgrades.
  const upgrading = db
    .prepare(`SELECT structure_key FROM build_slots WHERE planet_id = ?`)
    .all(planet.id) as { structure_key: string }[];
  if (upgrading.some((s) => SHIPYARD_LOCK_STRUCTURES.includes(s.structure_key))) {
    return { error: 'locked_shipyard_upgrading' };
  }

  const { placed } = db
    .prepare(`SELECT COUNT(*) AS placed FROM shipyard_orders WHERE planet_id = ?`)
    .get(planet.id) as { placed: number };
  if (placed >= SHIPYARD_ORDERS_MAX) return { error: 'shipyard_orders_full' };

  const structures = structureLevels(db, planet.id);
  const technologies = technologyLevels(db, planet.player_id);
  if (!shipRequirementStatus(def, { structures, technologies }).every((r) => r.met)) {
    return { error: 'requirements_not_met' };
  }

  const cost = orderCost(def, quantity);
  if (
    Math.floor(planet.alloy) < cost.alloy ||
    Math.floor(planet.crystal) < cost.crystal ||
    Math.floor(planet.deuterium) < cost.deuterium
  ) {
    return { error: 'cannot_afford' };
  }

  let startedAt: number | null = null;
  let unitDurationMs: number | null = null;
  if (placed === 0) {
    startedAt = now;
    unitDurationMs =
      shipUnitDurationSec(
        def.cost.alloy,
        def.cost.crystal,
        structures['orbital-shipyard'] ?? 0,
        structures['nanite-foundry'] ?? 0,
        speed,
      ) * 1000;
  }
  const { seq } = db
    .prepare(`SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM shipyard_orders WHERE planet_id = ?`)
    .get(planet.id) as { seq: number };

  db.prepare(
    `UPDATE planets SET alloy = alloy - ?, crystal = crystal - ?, deuterium = deuterium - ? WHERE id = ?`,
  ).run(cost.alloy, cost.crystal, cost.deuterium, planet.id);
  db.prepare(
    `INSERT INTO shipyard_orders
       (planet_id, seq, ship_key, quantity, completed, cost_alloy, cost_crystal, cost_deuterium,
        unit_duration_ms, started_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
  ).run(
    planet.id,
    seq,
    key,
    quantity,
    cost.alloy,
    cost.crystal,
    cost.deuterium,
    unitDurationMs,
    startedAt,
  );
  return { ok: true };
}
