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
    expect(body.fields).toEqual({ used: 0, inProgress: 0, max: 163 });
    expect(body.coordinatesLabel).toMatch(/^\[\d+:\d+:\d+\]$/);
    expect(body.temperature.min).toBe(body.temperature.max - 40);
    // Live-resource fields: base income only, capacity 10 000 each, Energy balanced.
    expect(body.ratesPerHour).toEqual({ alloy: 30, crystal: 15, deuterium: 0 });
    expect(body.storageCapacity).toEqual({ alloy: 10000, crystal: 10000, deuterium: 10000 });
    expect(body.energy).toEqual({ produced: 0, consumed: 0, productionFactor: 1 });
    expect(body.nextEventAt).toBeNull();
  });

  it('catches resources up by base income × Universe Speed and persists it', async () => {
    const clock = new ManualClock(1_000_000);
    app = buildApp({
      dbPath: ':memory:',
      clock,
      config: loadConfig({ SERVE_WEB: 'false', UNIVERSE_SPEED: '2' }),
      rng: () => 0.5,
    });
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'Rigel', password: 'password1' },
    });
    const cookie = `session=${reg.cookies.find((c) => c.name === 'session')!.value}`;

    clock.advance(3_600_000); // one hour
    const res = await app.inject({ method: 'GET', url: '/api/planet', headers: { cookie } });
    const body = res.json();
    // 500 + 30/h × speed 2, 500 + 15/h × 2.
    expect(body.resources.alloy).toBe(560);
    expect(body.resources.crystal).toBe(530);
    expect(body.lastUpdatedAt).toBe(4_600_000);

    // The catch-up is persisted: a second read at the same time does not double-count.
    const again = (
      await app.inject({ method: 'GET', url: '/api/planet', headers: { cookie } })
    ).json();
    expect(again.resources.alloy).toBe(560);
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
