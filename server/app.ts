import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import type { DatabaseSync } from 'node:sqlite';
import type { Clock } from './clock.ts';
import { systemClock } from './clock.ts';
import type { Config } from './config.ts';
import { open } from './db/open.ts';
import type { Rng } from './coords.ts';
import { LoginLimiter } from './auth/limiter.ts';
import { sweepExpiredSessions } from './auth/sessions.ts';
import { registerAuthRoutes } from './routes/auth.ts';
import { registerPlanetRoutes } from './routes/planet.ts';
import { registerResearchRoutes } from './routes/research.ts';
import { registerShipyardRoutes } from './routes/shipyard.ts';
import { registerStructureRoutes } from './routes/structures.ts';

export interface BuildAppOptions {
  dbPath: string;
  clock?: Clock;
  config: Config;
  /** Randomness source for Coordinates. Defaults to Math.random; tests inject a seeded rng. */
  rng?: Rng;
}

// The built web app lives in ../dist relative to this file.
const WEB_DIST = fileURLToPath(new URL('../dist', import.meta.url));

/**
 * Build a Fastify instance wired to the database, clock and config. It is *not* listening;
 * the caller decides when to `listen`. Tests use `app.inject()` against `:memory:`.
 */
export function buildApp(options: BuildAppOptions): FastifyInstance {
  const clock = options.clock ?? systemClock;
  const db: DatabaseSync = open(options.dbPath);

  // Sweep dead sessions once at startup so the table doesn't fill with expired rows (story 93).
  sweepExpiredSessions(db, clock.now());

  const app = Fastify({ logger: false });

  app.decorate('db', db);
  app.decorate('clock', clock);
  app.decorate('config', options.config);
  app.decorate('rng', options.rng ?? Math.random);
  app.decorate('loginLimiter', new LoginLimiter(clock));

  app.addHook('onClose', () => {
    db.close();
  });

  app.register(cookie);

  app.get('/api/health', () => ({
    status: 'ok',
    serverNow: clock.now(),
    universeSpeed: options.config.UNIVERSE_SPEED,
  }));

  registerAuthRoutes(app);
  registerPlanetRoutes(app);
  registerStructureRoutes(app);
  registerResearchRoutes(app);
  registerShipyardRoutes(app);

  // Serve the built SPA and fall back to index.html for client routes.
  if (options.config.SERVE_WEB && existsSync(WEB_DIST)) {
    app.register(fastifyStatic, { root: WEB_DIST });
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith('/api')) {
        reply.code(404).send({ error: 'not_found' });
        return;
      }
      reply.sendFile('index.html');
    });
  }

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseSync;
    clock: Clock;
    config: Config;
    rng: Rng;
    loginLimiter: LoginLimiter;
  }
}
