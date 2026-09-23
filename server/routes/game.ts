import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CommandResult } from '#shared/commands.ts';
import { advancePlayer, type PlayerState } from '#shared/player.ts';
import { tx } from '../db/tx.ts';
import { buildPlanetSnapshot, type PlanetSnapshot } from '../players/snapshot.ts';
import { loadPlayerState, savePlayerState } from '../players/state.ts';
import { csrf, requireSession } from './guards.ts';

// Bodies are strict JSON (the app turns Ajv type coercion off), so ids in the URL are matched as
// digit strings and converted by the handler.
export const ID_PARAM = { type: 'string', pattern: '^[0-9]{1,15}$' } as const;
export const EMPTY_BODY = { type: 'object' } as const;

/** A game command bound to its request: one of shared/commands.ts over the advanced state. */
export type Command = (state: PlayerState, now: number, speed: number) => CommandResult<string>;

type Outcome = { status: 200; snapshot: PlanetSnapshot } | { status: 404 | 409; error: string };

/**
 * Run a game command for the signed-in Player (`requireSession` has set `request.playerId`). In
 * one tx: load → advance (so boundaries that already passed settle before we validate, ADR
 * 0001) → command → save → snapshot. A rejection still saves the catch-up. Every rejection,
 * `not_found` included, is a 409 `{ error }`.
 */
export function runCommand(request: FastifyRequest, reply: FastifyReply, command: Command) {
  const { db, clock, config } = request.server;
  const now = clock.now();
  const speed = config.UNIVERSE_SPEED;

  const outcome = tx(db, (db): Outcome => {
    const loaded = loadPlayerState(db, request.playerId);
    if (!loaded) return { status: 404, error: 'no_planet' };

    const advanced = advancePlayer(loaded, now, speed);
    const result = command(advanced, now, speed);
    if ('error' in result) {
      savePlayerState(db, advanced);
      return { status: 409, error: result.error };
    }
    const saved = savePlayerState(db, result.state);
    return { status: 200, snapshot: buildPlanetSnapshot(saved, { serverNow: now, speed }) };
  });

  if (outcome.status !== 200) return reply.code(outcome.status).send({ error: outcome.error });
  return reply.send(outcome.snapshot);
}

/** Every game POST: session first (401), then CSRF (403/415), then the JSON schema (400). */
export function gamePost(schema: object) {
  return { onRequest: requireSession, preValidation: csrf, schema };
}
