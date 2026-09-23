import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.ts';
import { ManualClock } from '../clock.ts';
import { loadConfig } from '../config.ts';

// The API contract from spec #18: status-code precedence (401 before CSRF and schema checks),
// JSON-schema 400s, 409 not_found for unknown catalog keys and the auth payload shapes.

const GAME_POSTS = [
  { url: '/api/planet/rename', payload: { name: 'New Terra' } },
  { url: '/api/structures/alloy-extractor/upgrade', payload: {} },
  { url: '/api/build-slots/1/cancel', payload: {} },
  { url: '/api/research', payload: { technology: 'energy-theory' } },
  { url: '/api/research/1/cancel', payload: {} },
  { url: '/api/shipyard/orders', payload: { ship: 'hauler', quantity: 1 } },
];

describe('API contract', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildApp({
      dbPath: ':memory:',
      clock: new ManualClock(1_000_000),
      config: loadConfig({ SERVE_WEB: 'false', UNIVERSE_SPEED: '3' }),
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
    return `session=${reg.cookies.find((c) => c.name === 'session')!.value}`;
  }

  function post(url: string, payload: object | string, headers: Record<string, string> = {}) {
    return app.inject({ method: 'POST', url, payload, headers });
  }

  describe('without a session every game route is 401', () => {
    for (const { url, payload } of GAME_POSTS) {
      it(`${url}: even with a foreign Origin, a non-JSON body or a bad body`, async () => {
        expect((await post(url, payload)).statusCode).toBe(401);
        const foreign = await post(url, payload, { origin: 'http://evil.example' });
        expect(foreign.statusCode).toBe(401);
        const text = await post(url, 'x', { 'content-type': 'text/plain' });
        expect(text.statusCode).toBe(401);
        expect((await post(url, { bogus: [1] })).statusCode).toBe(401);
      });
    }

    it('GET /api/planet and /api/auth/me', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/planet' })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/api/auth/me' })).statusCode).toBe(401);
    });

    it('has no public health route; the me 401 carries the Universe Speed (story 16)', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(404);
      const me = await app.inject({ method: 'GET', url: '/api/auth/me' });
      expect(me.statusCode).toBe(401);
      expect(me.json()).toEqual({ error: 'unauthenticated', universeSpeed: 3 });
    });
  });

  describe('with a session', () => {
    it('keeps the CSRF rules: foreign Origin 403, non-JSON 415', async () => {
      const cookie = await register();
      const foreign = await post(
        '/api/structures/alloy-extractor/upgrade',
        {},
        {
          cookie,
          origin: 'http://evil.example',
        },
      );
      expect(foreign.statusCode).toBe(403);
      const text = await post('/api/structures/alloy-extractor/upgrade', '{}', {
        cookie,
        'content-type': 'text/plain',
      });
      expect(text.statusCode).toBe(415);
    });

    it('rejects bodies and params that fail the JSON schema with 400', async () => {
      const cookie = await register();
      const bad = [
        post('/api/planet/rename', {}, { cookie }),
        post('/api/planet/rename', { name: 42 }, { cookie }),
        post('/api/build-slots/one/cancel', {}, { cookie }),
        post('/api/research/abc/cancel', {}, { cookie }),
        post('/api/research', { technology: 7 }, { cookie }),
        post('/api/shipyard/orders', { ship: 'hauler', quantity: 1.5 }, { cookie }),
        post('/api/shipyard/orders', { ship: 'hauler' }, { cookie }),
        post('/api/auth/register', { username: 'Rigel' }),
        post('/api/auth/login', { username: 'Vega', password: 5 }),
      ];
      for (const res of await Promise.all(bad)) expect(res.statusCode).toBe(400);
    });

    it('answers an unknown catalog key with 409 not_found', async () => {
      const cookie = await register();
      const results = await Promise.all([
        post('/api/structures/death-star/upgrade', {}, { cookie }),
        post('/api/research', { technology: 'time-travel' }, { cookie }),
        post('/api/shipyard/orders', { ship: 'death-star', quantity: 1 }, { cookie }),
      ]);
      for (const res of results) {
        expect(res.statusCode).toBe(409);
        expect(res.json()).toEqual({ error: 'not_found' });
      }
    });
  });

  describe('auth payloads', () => {
    it('register → 201 { player, snapshot }', async () => {
      const res = await post('/api/auth/register', { username: 'Vega', password: 'password1' });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(Object.keys(body).sort()).toEqual(['player', 'snapshot']);
      expect(body.player.username).toBe('Vega');
      expect(body.snapshot.planet.name).toBe('Homeworld');
    });

    it('login → 200 { player } and me → { player }', async () => {
      const cookie = await register();
      const login = await post('/api/auth/login', { username: 'vega', password: 'password1' });
      expect(login.statusCode).toBe(200);
      expect(Object.keys(login.json())).toEqual(['player']);
      expect(login.json().player.username).toBe('Vega');

      const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
      expect(me.json()).toEqual({ player: login.json().player });
    });

    it('logout → 204 with no body', async () => {
      const cookie = await register();
      const res = await post('/api/auth/logout', {}, { cookie });
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
      // The session guard re-sends the cookie on every request; logout's clear must win.
      const sent = res.cookies.filter((c) => c.name === 'session');
      expect(sent).toHaveLength(1);
      expect(sent[0]!.maxAge).toBe(0);
    });
  });

  it('shapes the snapshot as the spec: universeSpeed and a nested planet with tmin/tmax', async () => {
    const cookie = await register();
    const res = await app.inject({ method: 'GET', url: '/api/planet', headers: { cookie } });
    const body = res.json();
    expect(body.universeSpeed).toBe(3);
    expect(Object.keys(body.planet).sort()).toEqual(
      [
        'coordinates',
        'coordinatesLabel',
        'diameterKm',
        'fields',
        'id',
        'name',
        'tmax',
        'tmin',
      ].sort(),
    );
    expect(body.planet.tmin).toBe(body.planet.tmax - 40);
    expect(body.planet.diameterKm).toBe(12_800);
    for (const moved of ['name', 'coordinates', 'fields', 'temperature', 'diameterKm']) {
      expect(body).not.toHaveProperty(moved);
    }
  });
});
