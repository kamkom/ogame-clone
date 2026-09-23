import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { cancelResearch, enqueueResearch } from '../players/research.ts';
import { EMPTY_BODY, ID_PARAM, gamePost, runCommand } from './game.ts';

const enqueueSchema = {
  body: {
    type: 'object',
    required: ['technology'],
    properties: { technology: { type: 'string', minLength: 1, maxLength: 64 } },
  },
};

const cancelSchema = {
  params: { type: 'object', required: ['entryId'], properties: { entryId: ID_PARAM } },
  body: EMPTY_BODY,
};

export function registerResearchRoutes(app: FastifyInstance): void {
  app.post(
    '/api/research',
    gamePost(enqueueSchema),
    (request: FastifyRequest, reply: FastifyReply) => {
      // An unknown catalog key is a 409 not_found, like every other rejection.
      const { technology } = request.body as { technology: string };
      return runCommand(request, reply, (db, planet, now, speed) =>
        enqueueResearch(db, planet, technology, now, speed),
      );
    },
  );

  app.post(
    '/api/research/:entryId/cancel',
    gamePost(cancelSchema),
    (request: FastifyRequest, reply: FastifyReply) => {
      // A missing entry is a 409 not_found: it may have just finished.
      const entryId = Number((request.params as { entryId: string }).entryId);
      return runCommand(request, reply, (db, planet, now, speed) =>
        cancelResearch(db, planet, entryId, now, speed),
      );
    },
  );
}
