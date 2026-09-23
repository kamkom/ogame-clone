import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { tx } from '../db/tx.ts';
import { advanceAndPersist } from '../players/economy.ts';
import { getPlanetByPlayer } from '../players/repo.ts';
import { enqueueResearch } from '../players/research.ts';
import { buildPlanetSnapshot, type PlanetSnapshot } from '../players/snapshot.ts';
import { passesCsrf, resolvePlayerId } from './guards.ts';

type Outcome =
  { status: 200; snapshot: PlanetSnapshot } | { status: 404 | 409; body: { error: string } };

const enqueueSchema = {
  body: {
    type: 'object',
    required: ['technology'],
    properties: { technology: { type: 'string', minLength: 1, maxLength: 64 } },
  },
};

export function registerResearchRoutes(app: FastifyInstance): void {
  app.post(
    '/api/research',
    { schema: enqueueSchema },
    (request: FastifyRequest, reply: FastifyReply) => {
      if (!passesCsrf(request, reply)) return;
      const playerId = resolvePlayerId(request);
      if (playerId === null) return reply.code(401).send({ error: 'unauthenticated' });

      const { technology } = request.body as { technology: string };
      const now = app.clock.now();
      const speed = app.config.UNIVERSE_SPEED;

      const outcome = tx(app.db, (db): Outcome => {
        const planet = getPlanetByPlayer(db, playerId);
        if (!planet) return { status: 404, body: { error: 'no_planet' } };

        // Catch up first, so finished Research frees queue room and counts toward requirements.
        const advanced = advanceAndPersist(db, planet, now, speed);
        const result = enqueueResearch(db, advanced, technology, now, speed);
        if ('error' in result) {
          const status = result.error === 'not_found' ? 404 : 409;
          return { status, body: { error: result.error } };
        }

        const updated = getPlanetByPlayer(db, playerId)!;
        return {
          status: 200,
          snapshot: buildPlanetSnapshot(db, updated, { serverNow: now, speed }),
        };
      });

      if (outcome.status !== 200) return reply.code(outcome.status).send(outcome.body);
      return reply.send(outcome.snapshot);
    },
  );
}
