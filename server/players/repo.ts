import type { DatabaseSync } from 'node:sqlite';
import type { Coordinates } from '#shared/coords.ts';
import { drawCoordinates, drawTmax, TMIN_OFFSET, type Rng } from '../coords.ts';
import { tx } from '../db/tx.ts';
import { hashPassword } from '../auth/passwords.ts';
import { createSession } from '../auth/sessions.ts';

// Registration values fixed by spec: 500 Alloy / 500 Crystal / 0 Deuterium, name "Homeworld".
export const STARTING_ALLOY = 500;
export const STARTING_CRYSTAL = 500;
export const STARTING_DEUTERIUM = 0;
export const DEFAULT_PLANET_NAME = 'Homeworld';
export const HOME_DIAMETER_KM = 12800;

// A collision on the Coordinates UNIQUE constraint just redraws; this caps the retries so a
// full Universe fails loudly instead of looping forever.
const MAX_COORD_ATTEMPTS = 100;

export interface Player {
  id: number;
  username: string;
}

/** A Player plus the stored password hash, used only by the login path. */
export interface PlayerAuth {
  id: number;
  username: string;
  password_hash: string;
}

export interface PlanetRow {
  id: number;
  player_id: number;
  name: string;
  galaxy: number;
  system: number;
  position: number;
  tmax: number;
  alloy: number;
  crystal: number;
  deuterium: number;
  resources_updated_at: number;
}

export function findPlayerByUsernameLower(
  db: DatabaseSync,
  usernameLower: string,
): PlayerAuth | null {
  return (
    (db
      .prepare(`SELECT id, username, password_hash FROM players WHERE username_lower = ?`)
      .get(usernameLower) as PlayerAuth | undefined) ?? null
  );
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes('UNIQUE');
}

/** Insert a Planet, redrawing Coordinates until the UNIQUE constraint is satisfied. */
function insertPlanet(
  db: DatabaseSync,
  playerId: number,
  now: number,
  rng: Rng,
  galaxies: number,
  systems: number,
): { id: number; coords: Coordinates; tmax: number } {
  const stmt = db.prepare(
    `INSERT INTO planets
       (player_id, name, galaxy, system, position, tmax, alloy, crystal, deuterium, resources_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (let attempt = 0; attempt < MAX_COORD_ATTEMPTS; attempt++) {
    const coords = drawCoordinates(rng, galaxies, systems);
    const tmax = drawTmax(rng, coords.position);
    try {
      const result = stmt.run(
        playerId,
        DEFAULT_PLANET_NAME,
        coords.galaxy,
        coords.system,
        coords.position,
        tmax,
        STARTING_ALLOY,
        STARTING_CRYSTAL,
        STARTING_DEUTERIUM,
        now,
      );
      return { id: Number(result.lastInsertRowid), coords, tmax };
    } catch (err) {
      if (isUniqueViolation(err)) continue; // Coordinates already taken — redraw.
      throw err;
    }
  }
  throw new Error('Could not find free Coordinates after many attempts; the Universe is full.');
}

export interface RegisterInput {
  username: string; // display casing, already validated
  password: string; // already validated
  now: number;
  rng: Rng;
  galaxies: number;
  systems: number;
  tokenHash: string;
}

export interface RegisterResult {
  playerId: number;
  planetId: number;
}

/**
 * Insert the Player, their Planet (with unique Coordinates) and their session in one
 * transaction. The caller has already validated the input and checked the token/casing.
 */
export function registerPlayer(db: DatabaseSync, input: RegisterInput): RegisterResult {
  return tx(db, (db) => {
    const passwordHash = hashPassword(input.password);
    const playerResult = db
      .prepare(
        `INSERT INTO players (username, username_lower, password_hash, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(input.username, input.username.toLowerCase(), passwordHash, input.now);
    const playerId = Number(playerResult.lastInsertRowid);

    const planet = insertPlanet(db, playerId, input.now, input.rng, input.galaxies, input.systems);
    createSession(db, input.tokenHash, playerId, input.now);

    return { playerId, planetId: planet.id };
  });
}

/** The Planet owned by `playerId`, or null. */
export function getPlanetByPlayer(db: DatabaseSync, playerId: number): PlanetRow | null {
  return (
    (db.prepare(`SELECT * FROM planets WHERE player_id = ?`).get(playerId) as
      PlanetRow | undefined) ?? null
  );
}

export function getPlayer(db: DatabaseSync, playerId: number): Player | null {
  return (
    (db.prepare(`SELECT id, username FROM players WHERE id = ?`).get(playerId) as
      Player | undefined) ?? null
  );
}

/** Compute a Planet's derived minimum temperature. */
export function tminFor(tmax: number): number {
  return tmax - TMIN_OFFSET;
}
