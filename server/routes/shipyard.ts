import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { tx } from '../db/tx.ts';
import { advanceAndPersist } from '../players/economy.ts';
import { getPlanetByPlayer } from '../players/repo.ts';
import { placeShipyardOrder } from '../players/shipyard.ts';
import { buildPlanetSnapshot, type PlanetSnapshot } from '../players/snapshot.ts';
import { passesCsrf, resolvePlayerId } from './guards.ts';

type Outcome =
  { status: 200; snapshot: PlanetSnapshot } | { status: 404 | 409; body: { error: string } };

// The quantity is only typed here; its 1–99,999 range is a game rule (409 invalid_quantity).
const orderSchema = {
  body: {
    type: 'object',
    required: ['ship', 'quantity'],
    properties: {
      ship: { type: 'string', minLength: 1, maxLength: 64 },
      quantity: { type: 'integer' },
    },
  },
};

export function registerShipyardRoutes(app: FastifyInstance): void {
  app.post(
    '/api/shipyard/orders',
    { schema: orderSchema },
    (request: FastifyRequest, reply: FastifyReply) => {
      if (!passesCsrf(request, reply)) return;
      const playerId = resolvePlayerId(request, reply);
      if (playerId === null) return reply.code(401).send({ error: 'unauthenticated' });

      const { ship, quantity } = request.body as { ship: string; quantity: number };
      const now = app.clock.now();
      const speed = app.config.UNIVERSE_SPEED;

      const outcome = tx(app.db, (db): Outcome => {
        const planet = getPlanetByPlayer(db, playerId);
        if (!planet) return { status: 404, body: { error: 'no_planet' } };

        // Catch up first, so finished Orders free room and the stock is current.
        const advanced = advanceAndPersist(db, planet, now, speed);
        const result = placeShipyardOrder(db, advanced, ship, quantity, now, speed);
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
