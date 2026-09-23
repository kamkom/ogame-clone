import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { tx } from '../db/tx.ts';
import { advanceAndPersist } from '../players/economy.ts';
import { getPlanetByPlayer, type PlanetRow } from '../players/repo.ts';
import { cancelResearch, enqueueResearch } from '../players/research.ts';
import { buildPlanetSnapshot, type PlanetSnapshot } from '../players/snapshot.ts';
import { passesCsrf, resolvePlayerId } from './guards.ts';

type Outcome =
  { status: 200; snapshot: PlanetSnapshot } | { status: 404 | 409; body: { error: string } };

type Command = (
  db: DatabaseSync,
  planet: PlanetRow,
  now: number,
  speed: number,
) => { ok: true } | { error: string };

const enqueueSchema = {
  body: {
    type: 'object',
    required: ['technology'],
    properties: { technology: { type: 'string', minLength: 1, maxLength: 64 } },
  },
};

export function registerResearchRoutes(app: FastifyInstance): void {
  /**
   * Guard the request, then in one tx catch the Planet up (so finished Research frees queue room
   * and counts toward requirements, ADR 0001), run `command` and return the new snapshot. A
   * command's `not_found` maps to `notFoundStatus`; every other rejection is a 409.
   */
  function handle(
    request: FastifyRequest,
    reply: FastifyReply,
    command: Command,
    notFoundStatus: 404 | 409,
  ) {
    if (!passesCsrf(request, reply)) return;
    const playerId = resolvePlayerId(request);
    if (playerId === null) return reply.code(401).send({ error: 'unauthenticated' });

    const now = app.clock.now();
    const speed = app.config.UNIVERSE_SPEED;

    const outcome = tx(app.db, (db): Outcome => {
      const planet = getPlanetByPlayer(db, playerId);
      if (!planet) return { status: 404, body: { error: 'no_planet' } };

      const advanced = advanceAndPersist(db, planet, now, speed);
      const result = command(db, advanced, now, speed);
      if ('error' in result) {
        const status = result.error === 'not_found' ? notFoundStatus : 409;
        return { status, body: { error: result.error } };
      }

      const updated = getPlanetByPlayer(db, playerId)!;
      return { status: 200, snapshot: buildPlanetSnapshot(db, updated, { serverNow: now, speed }) };
    });

    if (outcome.status !== 200) return reply.code(outcome.status).send(outcome.body);
    return reply.send(outcome.snapshot);
  }

  app.post(
    '/api/research',
    { schema: enqueueSchema },
    (request: FastifyRequest, reply: FastifyReply) => {
      const { technology } = request.body as { technology: string };
      // An unknown catalog key is a 404; the Technology doesn't exist.
      return handle(
        request,
        reply,
        (db, planet, now, speed) => enqueueResearch(db, planet, technology, now, speed),
        404,
      );
    },
  );

  app.post('/api/research/:entryId/cancel', (request: FastifyRequest, reply: FastifyReply) => {
    const entryId = Number((request.params as { entryId: string }).entryId);
    // A missing entry is a 409 not_found: it may have just finished.
    return handle(
      request,
      reply,
      (db, planet, now, speed) => cancelResearch(db, planet, entryId, now, speed),
      409,
    );
  });
}
