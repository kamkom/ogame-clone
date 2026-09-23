import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { cancelUpgrade, startUpgrade } from '../players/structures.ts';
import { EMPTY_BODY, ID_PARAM, gamePost, runCommand } from './game.ts';

const upgradeSchema = {
  params: {
    type: 'object',
    required: ['key'],
    properties: { key: { type: 'string', minLength: 1, maxLength: 64 } },
  },
  body: EMPTY_BODY,
};

const cancelSchema = {
  params: { type: 'object', required: ['slot'], properties: { slot: ID_PARAM } },
  body: EMPTY_BODY,
};

export function registerStructureRoutes(app: FastifyInstance): void {
  app.post(
    '/api/structures/:key/upgrade',
    gamePost(upgradeSchema),
    (request: FastifyRequest, reply: FastifyReply) => {
      // An unknown catalog key is a 409 not_found, like every other rejection.
      const { key } = request.params as { key: string };
      return runCommand(request, reply, (db, planet, now, speed) =>
        startUpgrade(db, planet, key, now, speed),
      );
    },
  );

  app.post(
    '/api/build-slots/:slot/cancel',
    gamePost(cancelSchema),
    (request: FastifyRequest, reply: FastifyReply) => {
      // An empty (or nonexistent) slot is a 409 not_found: the upgrade may have just finished.
      const slot = Number((request.params as { slot: string }).slot);
      return runCommand(request, reply, (db, planet, now, speed) =>
        cancelUpgrade(db, planet, slot, now, speed),
      );
    },
  );
}
