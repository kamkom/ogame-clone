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

  it('wires the injected clock and config into the routes', async () => {
    const clock = new ManualClock(1_700_000_000_000);
    const config = loadConfig({ UNIVERSE_SPEED: '8', SERVE_WEB: 'false' });
    app = buildApp({ dbPath: ':memory:', clock, config });

    const me = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(me.json()).toEqual({ error: 'unauthenticated', universeSpeed: 8 });

    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'Vega', password: 'password1' },
    });
    expect(reg.json().snapshot).toMatchObject({ serverNow: 1_700_000_000_000, universeSpeed: 8 });
  });
});
