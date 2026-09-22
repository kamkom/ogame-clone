import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getPlanetByPlayer } from '../players/repo.ts';
import { buildPlanetSnapshot } from '../players/snapshot.ts';
import { resolvePlayerId } from './guards.ts';

export function registerPlanetRoutes(app: FastifyInstance): void {
  app.get('/api/planet', (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = resolvePlayerId(request);
    if (playerId === null) return reply.code(401).send({ error: 'unauthenticated' });

    const planet = getPlanetByPlayer(app.db, playerId);
    if (!planet) return reply.code(404).send({ error: 'no_planet' });
    return reply.send(buildPlanetSnapshot(app.db, planet));
  });
}
