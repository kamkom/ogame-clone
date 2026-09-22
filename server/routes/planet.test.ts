import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.ts';
import { ManualClock } from '../clock.ts';
import { loadConfig } from '../config.ts';

describe('GET /api/planet', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    const config = loadConfig({ SERVE_WEB: 'false' });
    app = buildApp({
      dbPath: ':memory:',
      clock: new ManualClock(1_000_000),
      config,
      rng: () => 0.5,
    });
  });
  afterEach(async () => {
    await app.close();
  });

  it('returns 401 without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/planet' });
    expect(res.statusCode).toBe(401);
  });

  it('returns the Planet snapshot for a logged-in Player', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'Vega', password: 'password1' },
    });
    const cookieValue = reg.cookies.find((c) => c.name === 'session')!.value;

    const res = await app.inject({
      method: 'GET',
      url: '/api/planet',
      headers: { cookie: `session=${cookieValue}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('Homeworld');
    expect(body.fields).toEqual({ used: 0, max: 163 });
    expect(body.coordinatesLabel).toMatch(/^\[\d+:\d+:\d+\]$/);
    expect(body.temperature.min).toBe(body.temperature.max - 40);
  });
});

describe('POST /api/planet/rename', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    const config = loadConfig({ SERVE_WEB: 'false' });
    app = buildApp({
      dbPath: ':memory:',
      clock: new ManualClock(1_000_000),
      config,
      rng: () => 0.5,
    });
  });
  afterEach(async () => {
    await app.close();
  });

  async function register(): Promise<string> {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'Vega', password: 'password1' },
    });
    return reg.cookies.find((c) => c.name === 'session')!.value;
  }

  it('returns 401 without a session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/planet/rename',
      payload: { name: 'New Terra' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('persists a valid rename and returns it in the snapshot', async () => {
    const cookie = await register();
    const res = await app.inject({
      method: 'POST',
      url: '/api/planet/rename',
      headers: { cookie: `session=${cookie}` },
      payload: { name: '  New Terra  ' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('New Terra');

    // The change survives a fresh read.
    const after = await app.inject({
      method: 'GET',
      url: '/api/planet',
      headers: { cookie: `session=${cookie}` },
    });
    expect(after.json().name).toBe('New Terra');
  });

  it('rejects too short, too long, bad characters and double spaces with a 400 code', async () => {
    const cookie = await register();
    const cases: Array<[string, string]> = [
      ['a', 'length'],
      ['x'.repeat(21), 'length'],
      ['Bad!', 'chars'],
      ['New  Terra', 'spaces'],
    ];
    for (const [name, code] of cases) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/planet/rename',
        headers: { cookie: `session=${cookie}` },
        payload: { name },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: 'validation', code });
    }
  });
});
