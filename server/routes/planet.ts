import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { validatePlanetName } from '#shared/planetName.ts';
import { loadAdvancedPlanet } from '../players/economy.ts';
import { renamePlanet } from '../players/repo.ts';
import { buildPlanetSnapshot } from '../players/snapshot.ts';
import { requireSession } from './guards.ts';
import { gamePost, runCommand } from './game.ts';

// The name rules (length, characters, spaces) are shared/planetName.ts's 400 codes, not schema.
const renameSchema = {
  body: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
};

export function registerPlanetRoutes(app: FastifyInstance): void {
  app.get(
    '/api/planet',
    { onRequest: requireSession },
    (request: FastifyRequest, reply: FastifyReply) => {
      const now = app.clock.now();
      const speed = app.config.UNIVERSE_SPEED;
      const planet = loadAdvancedPlanet(app.db, request.playerId, now, speed);
      if (!planet) return reply.code(404).send({ error: 'no_planet' });
      return reply.send(buildPlanetSnapshot(app.db, planet, { serverNow: now, speed }));
    },
  );

  app.post(
    '/api/planet/rename',
    gamePost(renameSchema),
    (request: FastifyRequest, reply: FastifyReply) => {
      const result = validatePlanetName((request.body as { name: string }).name);
      if (result.error) return reply.code(400).send({ error: 'validation', code: result.error });

      return runCommand(request, reply, (db, planet) => {
        renamePlanet(db, planet.player_id, result.name);
        return { ok: true };
      });
    },
  );
}
