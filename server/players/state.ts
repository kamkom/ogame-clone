// The repositories behind the engine's Player state (shared/player.ts): load it from the tables,
// save it back. Routes run load → advance → command → save inside one `tx` (ADR 0001).

import type { DatabaseSync } from 'node:sqlite';
import {
  advancePlayer,
  type PlayerBuildSlot,
  type PlayerResearchEntry,
  type PlayerShipyardOrder,
  type PlayerState,
} from '#shared/player.ts';
import { tx } from '../db/tx.ts';
import { getPlanetByPlayer } from './repo.ts';

type CostRow = { cost_alloy: number; cost_crystal: number; cost_deuterium: number };

function costOf(r: CostRow) {
  return { alloy: r.cost_alloy, crystal: r.cost_crystal, deuterium: r.cost_deuterium };
}

/**
 * The `(key, value)` rows `sql` selects for `owner`, as a record; a missing key reads as 0 through
 * `levelOf`.
 */
function levels(db: DatabaseSync, sql: string, owner: number): Record<string, number> {
  const rows = db.prepare(sql).all(owner) as { key: string; value: number }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** The Player's state as stored, not yet advanced. Null when the Player has no Planet. */
export function loadPlayerState(db: DatabaseSync, playerId: number): PlayerState | null {
  const planet = getPlanetByPlayer(db, playerId);
  if (!planet) return null;

  const buildSlots = (
    db
      .prepare(
        `SELECT slot, structure_key, target_level, cost_alloy, cost_crystal, cost_deuterium,
                started_at, ends_at
           FROM build_slots WHERE planet_id = ? ORDER BY slot`,
      )
      .all(planet.id) as (CostRow & {
      slot: number;
      structure_key: string;
      target_level: number;
      started_at: number;
      ends_at: number;
    })[]
  ).map((r): PlayerBuildSlot => ({
    slot: r.slot,
    structure: r.structure_key,
    targetLevel: r.target_level,
    cost: costOf(r),
    startedAt: r.started_at,
    endsAt: r.ends_at,
  }));

  const researchQueue = (
    db
      .prepare(
        `SELECT id, technology_key, target_level, cost_alloy, cost_crystal, cost_deuterium,
                started_at, ends_at
           FROM research_queue WHERE player_id = ? ORDER BY seq`,
      )
      .all(playerId) as (CostRow & {
      id: number;
      technology_key: string;
      target_level: number;
      started_at: number | null;
      ends_at: number | null;
    })[]
  ).map((r): PlayerResearchEntry => ({
    id: r.id,
    technology: r.technology_key,
    targetLevel: r.target_level,
    cost: costOf(r),
    startedAt: r.started_at,
    endsAt: r.ends_at,
  }));

  const shipyardOrders = (
    db
      .prepare(
        `SELECT id, ship_key, quantity, completed, cost_alloy, cost_crystal, cost_deuterium,
                unit_duration_ms, started_at
           FROM shipyard_orders WHERE planet_id = ? ORDER BY seq`,
      )
      .all(planet.id) as (CostRow & {
      id: number;
      ship_key: string;
      quantity: number;
      completed: number;
      unit_duration_ms: number | null;
      started_at: number | null;
    })[]
  ).map((r): PlayerShipyardOrder => ({
    id: r.id,
    ship: r.ship_key,
    quantity: r.quantity,
    completed: r.completed,
    cost: costOf(r),
    unitDurationMs: r.unit_duration_ms,
    startedAt: r.started_at,
  }));

  return {
    planet: {
      id: planet.id,
      playerId: planet.player_id,
      name: planet.name,
      galaxy: planet.galaxy,
      system: planet.system,
      position: planet.position,
      tmax: planet.tmax,
    },
    resources: { alloy: planet.alloy, crystal: planet.crystal, deuterium: planet.deuterium },
    lastUpdatedAt: planet.resources_updated_at,
    structures: levels(
      db,
      `SELECT structure_key AS key, level AS value FROM planet_structures WHERE planet_id = ?`,
      planet.id,
    ),
    technologies: levels(
      db,
      `SELECT technology_key AS key, level AS value FROM player_technologies WHERE player_id = ?`,
      playerId,
    ),
    ships: levels(
      db,
      `SELECT ship_key AS key, count AS value FROM planet_ships WHERE planet_id = ?`,
      planet.id,
    ),
    buildSlots,
    researchQueue,
    shipyardOrders,
  };
}

/**
 * Write the whole state back: the Planet row, every level and count, and the three queues (their
 * rows replaced, in order). Entries without an id get one. Returns the state with those ids. Must
 * run inside a transaction.
 */
export function savePlayerState(db: DatabaseSync, state: PlayerState): PlayerState {
  const { planet, resources } = state;
  db.prepare(
    `UPDATE planets SET name = ?, alloy = ?, crystal = ?, deuterium = ?, resources_updated_at = ?
       WHERE id = ?`,
  ).run(
    planet.name,
    resources.alloy,
    resources.crystal,
    resources.deuterium,
    state.lastUpdatedAt,
    planet.id,
  );

  // Levels and counts only rise, so a key at 0 has no row to clear.
  const upsert = (sql: string, owner: number, values: Record<string, number>) => {
    const stmt = db.prepare(sql);
    for (const [key, value] of Object.entries(values)) if (value > 0) stmt.run(owner, key, value);
  };
  upsert(
    `INSERT INTO planet_structures (planet_id, structure_key, level) VALUES (?, ?, ?)
       ON CONFLICT(planet_id, structure_key) DO UPDATE SET level = excluded.level`,
    planet.id,
    state.structures,
  );
  upsert(
    `INSERT INTO player_technologies (player_id, technology_key, level) VALUES (?, ?, ?)
       ON CONFLICT(player_id, technology_key) DO UPDATE SET level = excluded.level`,
    planet.playerId,
    state.technologies,
  );
  upsert(
    `INSERT INTO planet_ships (planet_id, ship_key, count) VALUES (?, ?, ?)
       ON CONFLICT(planet_id, ship_key) DO UPDATE SET count = excluded.count`,
    planet.id,
    state.ships,
  );

  db.prepare(`DELETE FROM build_slots WHERE planet_id = ?`).run(planet.id);
  const insertSlot = db.prepare(
    `INSERT INTO build_slots
       (planet_id, slot, structure_key, target_level, cost_alloy, cost_crystal, cost_deuterium,
        started_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const bs of state.buildSlots) {
    const { alloy, crystal, deuterium } = bs.cost;
    insertSlot.run(
      planet.id,
      bs.slot,
      bs.structure,
      bs.targetLevel,
      alloy,
      crystal,
      deuterium,
      bs.startedAt,
      bs.endsAt,
    );
  }

  db.prepare(`DELETE FROM research_queue WHERE player_id = ?`).run(planet.playerId);
  const insertEntry = db.prepare(
    `INSERT INTO research_queue
       (id, player_id, seq, technology_key, target_level, cost_alloy, cost_crystal, cost_deuterium,
        lab_planet_id, started_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const researchQueue = state.researchQueue.map((e, i) => {
    const { alloy, crystal, deuterium } = e.cost;
    const { lastInsertRowid } = insertEntry.run(
      e.id,
      planet.playerId,
      i + 1,
      e.technology,
      e.targetLevel,
      alloy,
      crystal,
      deuterium,
      planet.id,
      e.startedAt,
      e.endsAt,
    );
    return { ...e, id: Number(lastInsertRowid) };
  });

  db.prepare(`DELETE FROM shipyard_orders WHERE planet_id = ?`).run(planet.id);
  const insertOrder = db.prepare(
    `INSERT INTO shipyard_orders
       (id, planet_id, seq, ship_key, quantity, completed, cost_alloy, cost_crystal, cost_deuterium,
        unit_duration_ms, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const shipyardOrders = state.shipyardOrders.map((o, i) => {
    const { alloy, crystal, deuterium } = o.cost;
    const { lastInsertRowid } = insertOrder.run(
      o.id,
      planet.id,
      i + 1,
      o.ship,
      o.quantity,
      o.completed,
      alloy,
      crystal,
      deuterium,
      o.unitDurationMs,
      o.startedAt,
    );
    return { ...o, id: Number(lastInsertRowid) };
  });

  return { ...state, researchQueue, shipyardOrders };
}

/**
 * Load a Player's state, advance it to `now` and save the catch-up, all in one `tx` (ADR 0001).
 * Read-only requests use this too, so every view of a Planet is current. Null without a Planet.
 */
export function loadAdvancedPlayer(
  db: DatabaseSync,
  playerId: number,
  now: number,
  speed: number,
): PlayerState | null {
  return tx(db, (db) => {
    const state = loadPlayerState(db, playerId);
    return state && savePlayerState(db, advancePlayer(state, now, speed));
  });
}
