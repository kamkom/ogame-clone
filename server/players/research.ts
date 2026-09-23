import type { DatabaseSync } from 'node:sqlite';
import { technologyDef } from '#shared/catalog.ts';
import { researchDurationSec } from '#shared/economy.ts';
import {
  RESEARCH_QUEUE_MAX,
  requirementStatus,
  researchTargetLevel,
  technologyCost,
} from '#shared/research.ts';
import { readResearchQueue } from './economy.ts';
import { type PlanetRow, structureLevels, technologyLevels } from './repo.ts';

/** A typed reason Research could not be queued. `not_found` is an unknown catalog key (404); the rest are 409s. */
export type ResearchRejection =
  'not_found' | 'research_queue_full' | 'requirements_not_met' | 'cannot_afford';

export type EnqueueResult = { ok: true } | { error: ResearchRejection };

/**
 * Queue Research of `key` for the Player owning `planet` (spec stories 53–56). The entry is paid now
 * and its level and cost are fixed now: one past the current level and any queued entries of the
 * same Technology. A Technology requirement may be met by an earlier entry; a Structure requirement
 * must already be built. When the queue was empty the entry starts at once, its duration fixed from
 * the current Research Lab level; otherwise it waits (null times) until the engine starts it.
 * `planet` must already be advanced to `now`. Runs inside the caller's transaction.
 */
export function enqueueResearch(
  db: DatabaseSync,
  planet: PlanetRow,
  key: string,
  now: number,
  speed: number,
): EnqueueResult {
  const def = technologyDef(key);
  if (!def) return { error: 'not_found' };

  const queue = readResearchQueue(db, planet.player_id).map((e) => ({
    technology: e.technologyKey,
    targetLevel: e.targetLevel,
  }));
  if (queue.length >= RESEARCH_QUEUE_MAX) return { error: 'research_queue_full' };

  const structures = structureLevels(db, planet.id);
  const technologies = technologyLevels(db, planet.player_id);
  const status = requirementStatus(def.requires, { structures, technologies }, queue);
  if (!status.every((r) => r.met)) return { error: 'requirements_not_met' };

  const targetLevel = researchTargetLevel(key, technologies[key] ?? 0, queue);
  const cost = technologyCost(def, targetLevel);
  if (
    Math.floor(planet.alloy) < cost.alloy ||
    Math.floor(planet.crystal) < cost.crystal ||
    Math.floor(planet.deuterium) < cost.deuterium
  ) {
    return { error: 'cannot_afford' };
  }

  let startedAt: number | null = null;
  let endsAt: number | null = null;
  if (queue.length === 0) {
    const lab = structures['research-lab'] ?? 0;
    startedAt = now;
    endsAt = now + researchDurationSec(cost.alloy, cost.crystal, lab, speed) * 1000;
  }
  const { seq } = db
    .prepare(`SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM research_queue WHERE player_id = ?`)
    .get(planet.player_id) as { seq: number };

  db.prepare(
    `UPDATE planets SET alloy = alloy - ?, crystal = crystal - ?, deuterium = deuterium - ? WHERE id = ?`,
  ).run(cost.alloy, cost.crystal, cost.deuterium, planet.id);
  db.prepare(
    `INSERT INTO research_queue
       (player_id, seq, technology_key, target_level, cost_alloy, cost_crystal, cost_deuterium,
        lab_planet_id, started_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    planet.player_id,
    seq,
    key,
    targetLevel,
    cost.alloy,
    cost.crystal,
    cost.deuterium,
    planet.id,
    startedAt,
    endsAt,
  );
  return { ok: true };
}
