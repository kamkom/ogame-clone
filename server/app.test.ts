import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.ts';
import { ManualClock } from './clock.ts';
import { loadConfig } from './config.ts';

describe('buildApp', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('serves /api/health with the injected clock and config', async () => {
    const clock = new ManualClock(1_700_000_000_000);
    const config = loadConfig({ UNIVERSE_SPEED: '8', SERVE_WEB: 'false' });
    app = buildApp({ dbPath: ':memory:', clock, config });

    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'ok',
      serverNow: 1_700_000_000_000,
      universeSpeed: 8,
    });
  });
});
