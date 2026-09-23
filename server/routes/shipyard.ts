import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { placeShipyardOrder } from '../players/shipyard.ts';
import { gamePost, runCommand } from './game.ts';

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
    gamePost(orderSchema),
    (request: FastifyRequest, reply: FastifyReply) => {
      // Catching up first frees room from finished Orders and makes the stock current.
      const { ship, quantity } = request.body as { ship: string; quantity: number };
      return runCommand(request, reply, (db, planet, now, speed) =>
        placeShipyardOrder(db, planet, ship, quantity, now, speed),
      );
    },
  );
}
