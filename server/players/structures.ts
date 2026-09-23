import type { DatabaseSync } from 'node:sqlite';
import { levelCost, maxFields, structureDurationSec } from '#shared/economy.ts';
import { requirementStatus, structureDef } from '#shared/catalog.ts';
import type { PlanetRow } from './repo.ts';

/** A typed reason an upgrade could not start. `not_found` is an unknown catalog key (404); the rest are 409s. */
export type UpgradeRejection =
  | 'not_found'
  | 'already_in_progress'
  | 'slots_full'
  | 'locked_research_active'
  | 'requirements_not_met'
  | 'fields_full'
  | 'cannot_afford';

export type UpgradeResult = { ok: true } | { error: UpgradeRejection };

/** A typed reason a Cancel was refused: the slot holds no running upgrade. */
export type CancelResult = { ok: true } | { error: 'not_found' };

const SLOT_COUNT = 2;

/** The stored level of a Structure on a Planet (0 when there is no row). */
function levelOf(db: DatabaseSync, planetId: number, key: string): number {
  const row = db
    .prepare(`SELECT level FROM planet_structures WHERE planet_id = ? AND structure_key = ?`)
    .get(planetId, key) as { level: number } | undefined;
  return row?.level ?? 0;
}

/** The stored level of a Technology for a Player (0 when there is no row). */
function techLevelOf(db: DatabaseSync, playerId: number, key: string): number {
  const row = db
    .prepare(`SELECT level FROM player_technologies WHERE player_id = ? AND technology_key = ?`)
    .get(playerId, key) as { level: number } | undefined;
  return row?.level ?? 0;
}

/** Whether the Player has a Research Queue head running. */
function researchActive(db: DatabaseSync, playerId: number): boolean {
  return (
    db
      .prepare(`SELECT 1 FROM research_queue WHERE player_id = ? AND started_at IS NOT NULL`)
      .get(playerId) !== undefined
  );
}

/** A Planet's Fields: finished levels, upgrades running in a Build Slot, and the max. */
export function planetFields(
  db: DatabaseSync,
  planetId: number,
): { used: number; inProgress: number; max: number } {
  const { used } = db
    .prepare(`SELECT COALESCE(SUM(level), 0) AS used FROM planet_structures WHERE planet_id = ?`)
    .get(planetId) as { used: number };
  const { inProgress } = db
    .prepare(`SELECT COUNT(*) AS inProgress FROM build_slots WHERE planet_id = ?`)
    .get(planetId) as { inProgress: number };
  return {
    used: Number(used),
    inProgress: Number(inProgress),
    max: maxFields(levelOf(db, planetId, 'terraformer')),
  };
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
  // Research Lab lock: the Lab can't start upgrading while Research is running (queue rule 14).
  if (key === 'research-lab' && researchActive(db, planet.player_id)) {
    return { error: 'locked_research_active' };
  }

  // Requirements use finished levels only; a level still in a Build Slot doesn't count.
  const currentLevel = (k: string) =>
    structureDef(k) ? levelOf(db, planet.id, k) : techLevelOf(db, planet.player_id, k);
  if (requirementStatus(def, currentLevel).some((r) => !r.met))
    return { error: 'requirements_not_met' };

  const fields = planetFields(db, planet.id);
  if (fields.used + fields.inProgress >= fields.max) return { error: 'fields_full' };

  const targetLevel = currentLevel(key) + 1;
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

  const robotics = currentLevel('robotics-works');
  const nanite = currentLevel('nanite-foundry');
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

/**
 * Cancel the upgrade running in Build Slot `slot`: refund exactly what was paid for it, free the
 * slot and so return its Field (spec story 47). `planet` must already be advanced to now, so an
 * upgrade that has finished is no longer in its slot. Runs inside the caller's transaction.
 */
export function cancelUpgrade(db: DatabaseSync, planet: PlanetRow, slot: number): CancelResult {
  const row = db
    .prepare(
      `SELECT cost_alloy, cost_crystal, cost_deuterium FROM build_slots WHERE planet_id = ? AND slot = ?`,
    )
    .get(planet.id, slot) as
    { cost_alloy: number; cost_crystal: number; cost_deuterium: number } | undefined;
  if (!row) return { error: 'not_found' };

  db.prepare(
    `UPDATE planets SET alloy = alloy + ?, crystal = crystal + ?, deuterium = deuterium + ? WHERE id = ?`,
  ).run(row.cost_alloy, row.cost_crystal, row.cost_deuterium, planet.id);
  db.prepare(`DELETE FROM build_slots WHERE planet_id = ? AND slot = ?`).run(planet.id, slot);
  return { ok: true };
}
