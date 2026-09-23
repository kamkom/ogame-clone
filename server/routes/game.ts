import type { DatabaseSync } from 'node:sqlite';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { tx } from '../db/tx.ts';
import { advanceAndPersist } from '../players/economy.ts';
import { getPlanetByPlayer, type PlanetRow } from '../players/repo.ts';
import { buildPlanetSnapshot, type PlanetSnapshot } from '../players/snapshot.ts';
import { csrf, requireSession } from './guards.ts';

// Bodies are strict JSON (the app turns Ajv type coercion off), so ids in the URL are matched as
// digit strings and converted by the handler.
export const ID_PARAM = { type: 'string', pattern: '^[0-9]{1,15}$' } as const;
export const EMPTY_BODY = { type: 'object' } as const;

/** A game command: validate against the advanced Planet, then apply it or name the rejection. */
export type Command = (
  db: DatabaseSync,
  planet: PlanetRow,
  now: number,
  speed: number,
) => { ok: true } | { error: string };

type Outcome = { status: 200; snapshot: PlanetSnapshot } | { status: 404 | 409; error: string };

/**
 * Run a game command for the signed-in Player (`requireSession` has set `request.playerId`). In
 * one tx: load → advance (so boundaries that already passed settle before we validate, ADR
 * 0001) → command → snapshot. Every rejection, `not_found` included, is a 409 `{ error }`.
 */
export function runCommand(request: FastifyRequest, reply: FastifyReply, command: Command) {
  const { db, clock, config } = request.server;
  const now = clock.now();
  const speed = config.UNIVERSE_SPEED;

  const outcome = tx(db, (db): Outcome => {
    const planet = getPlanetByPlayer(db, request.playerId);
    if (!planet) return { status: 404, error: 'no_planet' };

    const advanced = advanceAndPersist(db, planet, now, speed);
    const result = command(db, advanced, now, speed);
    if ('error' in result) return { status: 409, error: result.error };

    const updated = getPlanetByPlayer(db, request.playerId)!;
    return { status: 200, snapshot: buildPlanetSnapshot(db, updated, { serverNow: now, speed }) };
  });

  if (outcome.status !== 200) return reply.code(outcome.status).send({ error: outcome.error });
  return reply.send(outcome.snapshot);
}

/** Every game POST: session first (401), then CSRF (403/415), then the JSON schema (400). */
export function gamePost(schema: object) {
  return { onRequest: requireSession, preValidation: csrf, schema };
}
