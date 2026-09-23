import type { DatabaseSync } from 'node:sqlite';
import { levelCost, structureDurationSec } from '#shared/economy.ts';
import { structureDef } from '#shared/catalog.ts';
import type { PlanetRow } from './repo.ts';

/** A typed reason an upgrade could not start. `not_found` is an unknown catalog key (404); the rest are 409s. */
export type UpgradeRejection = 'not_found' | 'already_in_progress' | 'slots_full' | 'cannot_afford';

export type UpgradeResult = { ok: true } | { error: UpgradeRejection };

const SLOT_COUNT = 2;

/** The stored level of a Structure on a Planet (0 when there is no row). */
function levelOf(db: DatabaseSync, planetId: number, key: string): number {
  const row = db
    .prepare(`SELECT level FROM planet_structures WHERE planet_id = ? AND structure_key = ?`)
    .get(planetId, key) as { level: number } | undefined;
  return row?.level ?? 0;
}

/**
 * Start upgrading `key` into a free Build Slot on `planet`, paying the level's cost now and fixing
 * its duration from the current Robotics Works and Nanite Foundry levels (spec stories 39, 41).
 * `planet` must already be advanced to `now` (so its resources and slots are current). Runs inside
 * the caller's transaction; on success it deducts the cost and inserts the slot row.
 */
export function startUpgrade(
  db: DatabaseSync,
  planet: PlanetRow,
  key: string,
  now: number,
  speed: number,
): UpgradeResult {
  const def = structureDef(key);
  if (!def) return { error: 'not_found' };

  const slots = db
    .prepare(`SELECT slot, structure_key FROM build_slots WHERE planet_id = ?`)
    .all(planet.id) as { slot: number; structure_key: string }[];
  if (slots.some((s) => s.structure_key === key)) return { error: 'already_in_progress' };
  if (slots.length >= SLOT_COUNT) return { error: 'slots_full' };

  const targetLevel = levelOf(db, planet.id, key) + 1;
  const cost = {
    alloy: levelCost(def.baseCost.alloy, def.factor, targetLevel),
    crystal: levelCost(def.baseCost.crystal, def.factor, targetLevel),
    deuterium: levelCost(def.baseCost.deuterium, def.factor, targetLevel),
  };
  if (
    Math.floor(planet.alloy) < cost.alloy ||
    Math.floor(planet.crystal) < cost.crystal ||
    Math.floor(planet.deuterium) < cost.deuterium
  ) {
    return { error: 'cannot_afford' };
  }

  const robotics = levelOf(db, planet.id, 'robotics-works');
  const nanite = levelOf(db, planet.id, 'nanite-foundry');
  const durationSec = structureDurationSec(
    cost.alloy,
    cost.crystal,
    targetLevel,
    robotics,
    nanite,
    speed,
    def.isNaniteFoundry ?? false,
  );
  const endsAt = now + durationSec * 1000;
  const freeSlot = slots.some((s) => s.slot === 1) ? 2 : 1;

  db.prepare(
    `UPDATE planets SET alloy = alloy - ?, crystal = crystal - ?, deuterium = deuterium - ? WHERE id = ?`,
  ).run(cost.alloy, cost.crystal, cost.deuterium, planet.id);
  db.prepare(
    `INSERT INTO build_slots
       (planet_id, slot, structure_key, target_level, cost_alloy, cost_crystal, cost_deuterium, started_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    planet.id,
    freeSlot,
    key,
    targetLevel,
    cost.alloy,
    cost.crystal,
    cost.deuterium,
    now,
    endsAt,
  );
  return { ok: true };
}
