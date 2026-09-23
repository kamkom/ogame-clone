import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  alloyMineEnergyUse,
  crystalMineEnergyUse,
  deuteriumSynthEnergyUse,
  fusionReactorEnergy,
  maxFields,
  productionFactor,
  solarPlantEnergy,
  solarSatelliteEnergy,
} from '#shared/economy.ts';
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
    expect(body.planet.name).toBe('Homeworld');
    expect(body.planet.fields).toEqual({ used: 0, inProgress: 0, max: 163 });
    expect(body.planet.coordinatesLabel).toMatch(/^\[\d+:\d+:\d+\]$/);
    expect(body.planet.tmin).toBe(body.planet.tmax - 40);
    // Live-resource fields: base income only, capacity 10 000 each, Energy balanced.
    expect(body.ratesPerHour).toEqual({ alloy: 30, crystal: 15, deuterium: 0 });
    expect(body.storageCapacity).toEqual({ alloy: 10000, crystal: 10000, deuterium: 10000 });
    expect(body.energy).toEqual({ produced: 0, consumed: 0, productionFactor: 1 });
    expect(body.nextEventAt).toBeNull();
  });

  it('reports Fields, temperature and Energy by the shared formulas (Fusion Reactor + Solar Satellites)', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'Vega', password: 'password1' },
    });
    const cookie = `session=${reg.cookies.find((c) => c.name === 'session')!.value}`;
    // Test setup only: built levels, docked satellites and a Deuterium stock to fuel the Reactor.
    const { id, player_id, tmax } = app.db
      .prepare(`SELECT id, player_id, tmax FROM planets`)
      .get() as { id: number; player_id: number; tmax: number };
    app.db.prepare(`UPDATE planets SET deuterium = 100000`).run();
    const levels = {
      'alloy-extractor': 12,
      'crystal-refinery': 10,
      'deuterium-synthesizer': 8,
      'solar-array': 10,
      'fusion-reactor': 3,
      terraformer: 3,
    };
    for (const [key, level] of Object.entries(levels)) {
      app.db
        .prepare(`INSERT INTO planet_structures (planet_id, structure_key, level) VALUES (?, ?, ?)`)
        .run(id, key, level);
    }
    app.db
      .prepare(
        `INSERT INTO player_technologies (player_id, technology_key, level) VALUES (?, ?, ?)`,
      )
      .run(player_id, 'energy-theory', 4);
    app.db
      .prepare(`INSERT INTO planet_ships (planet_id, ship_key, count) VALUES (?, ?, ?)`)
      .run(id, 'solar-satellite', 7);

    const body = (
      await app.inject({ method: 'GET', url: '/api/planet', headers: { cookie } })
    ).json();

    expect(body.planet.fields).toEqual({ used: 46, inProgress: 0, max: maxFields(3) });
    expect(body.planet).toMatchObject({ tmin: tmax - 40, tmax });
    expect(body.planet.diameterKm).toBe(12_800);
    const produced =
      solarPlantEnergy(10) + fusionReactorEnergy(3, 4) + solarSatelliteEnergy(7, tmax - 20);
    const consumed = alloyMineEnergyUse(12) + crystalMineEnergyUse(10) + deuteriumSynthEnergyUse(8);
    expect(body.energy).toEqual({
      produced,
      consumed,
      productionFactor: productionFactor(produced, consumed),
    });
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
    expect(res.json().planet.name).toBe('New Terra');

    // The change survives a fresh read.
    const after = await app.inject({
      method: 'GET',
      url: '/api/planet',
      headers: { cookie: `session=${cookie}` },
    });
    expect(after.json().planet.name).toBe('New Terra');
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
