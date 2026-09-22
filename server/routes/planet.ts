import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { validatePlanetName } from '#shared/planetName.ts';
import { getPlanetByPlayer, renamePlanet } from '../players/repo.ts';
import { buildPlanetSnapshot } from '../players/snapshot.ts';
import { passesCsrf, resolvePlayerId } from './guards.ts';

export function registerPlanetRoutes(app: FastifyInstance): void {
  app.get('/api/planet', (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = resolvePlayerId(request);
    if (playerId === null) return reply.code(401).send({ error: 'unauthenticated' });

    const planet = getPlanetByPlayer(app.db, playerId);
    if (!planet) return reply.code(404).send({ error: 'no_planet' });
    return reply.send(buildPlanetSnapshot(app.db, planet));
  });

  app.post('/api/planet/rename', (request: FastifyRequest, reply: FastifyReply) => {
    if (!passesCsrf(request, reply)) return;
    const playerId = resolvePlayerId(request);
    if (playerId === null) return reply.code(401).send({ error: 'unauthenticated' });

    const { name } = (request.body ?? {}) as { name?: unknown };
    const result = validatePlanetName(name);
    if (result.error) return reply.code(400).send({ error: 'validation', code: result.error });

    const planet = renamePlanet(app.db, playerId, result.name);
    if (!planet) return reply.code(404).send({ error: 'no_planet' });
    return reply.send(buildPlanetSnapshot(app.db, planet));
  });
}
