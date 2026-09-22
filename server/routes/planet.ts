import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { validatePlanetName } from '#shared/planetName.ts';
import { loadAdvancedPlanet } from '../players/economy.ts';
import { renamePlanet } from '../players/repo.ts';
import { buildPlanetSnapshot } from '../players/snapshot.ts';
import { passesCsrf, resolvePlayerId } from './guards.ts';

export function registerPlanetRoutes(app: FastifyInstance): void {
  app.get('/api/planet', (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = resolvePlayerId(request);
    if (playerId === null) return reply.code(401).send({ error: 'unauthenticated' });

    const now = app.clock.now();
    const speed = app.config.UNIVERSE_SPEED;
    const planet = loadAdvancedPlanet(app.db, playerId, now, speed);
    if (!planet) return reply.code(404).send({ error: 'no_planet' });
    return reply.send(buildPlanetSnapshot(app.db, planet, { serverNow: now, speed }));
  });

  app.post('/api/planet/rename', (request: FastifyRequest, reply: FastifyReply) => {
    if (!passesCsrf(request, reply)) return;
    const playerId = resolvePlayerId(request);
    if (playerId === null) return reply.code(401).send({ error: 'unauthenticated' });

    const { name } = (request.body ?? {}) as { name?: unknown };
    const result = validatePlanetName(name);
    if (result.error) return reply.code(400).send({ error: 'validation', code: result.error });

    if (!renamePlanet(app.db, playerId, result.name)) {
      return reply.code(404).send({ error: 'no_planet' });
    }

    const now = app.clock.now();
    const speed = app.config.UNIVERSE_SPEED;
    const planet = loadAdvancedPlanet(app.db, playerId, now, speed);
    if (!planet) return reply.code(404).send({ error: 'no_planet' });
    return reply.send(buildPlanetSnapshot(app.db, planet, { serverNow: now, speed }));
  });
}
