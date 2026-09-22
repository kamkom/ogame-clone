import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { loadAdvancedPlanet } from '../players/economy.ts';
import { buildPlanetSnapshot } from '../players/snapshot.ts';
import { resolvePlayerId } from './guards.ts';

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
}
