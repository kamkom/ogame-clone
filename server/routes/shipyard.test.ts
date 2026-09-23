import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { solarSatelliteEnergy } from '#shared/economy.ts';
import { buildApp } from '../app.ts';
import { ManualClock } from '../clock.ts';
import { loadConfig } from '../config.ts';

const T0 = 1_000_000;
// At Orbital Shipyard 1: a Solar Satellite (0 / 2000) takes 1440 s per unit, a Hauler (2000 / 2000)
// 2880 s and an Interceptor (3000 / 1000) 2880 s.
const SAT_MS = 1_440_000;
const INTERCEPTOR_MS = 2_880_000;

describe('POST /api/shipyard/orders', () => {
  let app: FastifyInstance;
  let clock: ManualClock;

  beforeEach(() => {
    clock = new ManualClock(T0);
    app = buildApp({
      dbPath: ':memory:',
      clock,
      config: loadConfig({ SERVE_WEB: 'false' }),
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

  // Test setup only: give the Planet a stock plus built Structure and Technology levels directly.
  function seed(
    resources: number,
    structures: Record<string, number> = {},
    technologies: Record<string, number> = {},
  ): void {
    app.db
      .prepare(`UPDATE planets SET alloy = ?, crystal = ?, deuterium = ?`)
      .run(resources, resources, resources);
    const { id, player_id } = app.db.prepare(`SELECT id, player_id FROM planets`).get() as {
      id: number;
      player_id: number;
    };
    for (const [key, level] of Object.entries(structures)) {
      app.db
        .prepare(`INSERT INTO planet_structures (planet_id, structure_key, level) VALUES (?, ?, ?)`)
        .run(id, key, level);
    }
    for (const [key, level] of Object.entries(technologies)) {
      app.db
        .prepare(
          `INSERT INTO player_technologies (player_id, technology_key, level) VALUES (?, ?, ?)`,
        )
        .run(player_id, key, level);
    }
  }

  function order(cookie: string, ship: unknown, quantity: unknown) {
    return app.inject({
      method: 'POST',
      url: '/api/shipyard/orders',
      headers: { cookie },
      payload: { ship, quantity },
    });
  }

  function getPlanet(cookie: string) {
    return app.inject({ method: 'GET', url: '/api/planet', headers: { cookie } });
  }

  it('requires a session', async () => {
    expect((await order('', 'hauler', 1)).statusCode).toBe(401);
  });

  it('lists every ship at 0 and no Orders in the snapshot', async () => {
    const cookie = await register();
    const body = (await getPlanet(cookie)).json();
    expect(Object.keys(body.ships)).toHaveLength(9);
    expect(body.ships['solar-satellite']).toBe(0);
    expect(body.shipyardOrders).toEqual([]);
  });

  it('deducts the full cost and starts the first Order at once', async () => {
    const cookie = await register();
    seed(100_000, { 'orbital-shipyard': 1 });
    const res = await order(cookie, 'solar-satellite', 3);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.resources).toEqual({ alloy: 100_000, crystal: 94_000, deuterium: 98_500 });
    expect(body.shipyardOrders).toEqual([
      {
        id: expect.any(Number),
        ship: 'solar-satellite',
        quantity: 3,
        completed: 0,
        cost: { alloy: 0, crystal: 6000, deuterium: 1500 },
        unitDurationMs: SAT_MS,
        startedAt: T0,
        nextUnitAt: T0 + SAT_MS,
        endsAt: T0 + 3 * SAT_MS,
      },
    ]);
    expect(body.nextEventAt).toBe(T0 + SAT_MS);
  });

  it('rolls Solar Satellites out one by one, raising the docked count and Energy each time', async () => {
    const cookie = await register();
    seed(100_000, { 'orbital-shipyard': 1 });
    const before = (await order(cookie, 'solar-satellite', 3)).json();
    const perSatellite = solarSatelliteEnergy(1, before.temperature.max - 20);
    expect(before.energy.produced).toBe(0);

    for (const n of [1, 2]) {
      clock.advance(SAT_MS);
      const body = (await getPlanet(cookie)).json();
      expect(body.ships['solar-satellite']).toBe(n);
      expect(body.energy.produced).toBe(n * perSatellite);
      expect(body.shipyardOrders[0]).toMatchObject({
        completed: n,
        nextUnitAt: T0 + (n + 1) * SAT_MS,
      });
    }

    clock.advance(SAT_MS);
    const done = (await getPlanet(cookie)).json();
    expect(done.ships['solar-satellite']).toBe(3);
    expect(done.energy.produced).toBe(3 * perSatellite);
    expect(done.shipyardOrders).toEqual([]);
  });

  it('runs Orders one after another, the second waiting until the first finishes', async () => {
    const cookie = await register();
    seed(100_000, { 'orbital-shipyard': 2 }, { 'combustion-drive': 2 });
    await order(cookie, 'solar-satellite', 1);
    const res = (await order(cookie, 'hauler', 2)).json();
    const satMs = 960_000; // 2000 / 7500 h at Shipyard 2
    const haulerMs = 1_920_000;
    expect(res.shipyardOrders[1]).toMatchObject({
      ship: 'hauler',
      unitDurationMs: null,
      startedAt: null,
      nextUnitAt: null,
      endsAt: null,
    });

    clock.advance(satMs + 1000);
    const mid = (await getPlanet(cookie)).json();
    expect(mid.ships['solar-satellite']).toBe(1);
    expect(mid.shipyardOrders).toEqual([
      expect.objectContaining({
        ship: 'hauler',
        startedAt: T0 + satMs,
        unitDurationMs: haulerMs,
        endsAt: T0 + satMs + 2 * haulerMs,
      }),
    ]);

    clock.advance(2 * haulerMs);
    const done = (await getPlanet(cookie)).json();
    expect(done.ships.hauler).toBe(2);
    expect(done.shipyardOrders).toEqual([]);
  });

  it('rejects quantity 0 or 100,000 with 409 invalid_quantity', async () => {
    const cookie = await register();
    seed(1e12, { 'orbital-shipyard': 1 });
    for (const quantity of [0, 100_000, -3]) {
      const res = await order(cookie, 'solar-satellite', quantity);
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'invalid_quantity' });
    }
    expect((await order(cookie, 'solar-satellite', 99_999)).statusCode).toBe(200);
  });

  it('rejects a fractional or missing quantity with 400', async () => {
    const cookie = await register();
    expect((await order(cookie, 'solar-satellite', 1.5)).statusCode).toBe(400);
    const missing = await app.inject({
      method: 'POST',
      url: '/api/shipyard/orders',
      headers: { cookie },
      payload: { ship: 'solar-satellite' },
    });
    expect(missing.statusCode).toBe(400);
  });

  it('rejects the 11th Order with 409 shipyard_orders_full', async () => {
    const cookie = await register();
    seed(1e6, { 'orbital-shipyard': 1 });
    for (let i = 0; i < 10; i++) {
      expect((await order(cookie, 'solar-satellite', 1)).statusCode).toBe(200);
    }
    const eleventh = await order(cookie, 'solar-satellite', 1);
    expect(eleventh.statusCode).toBe(409);
    expect(eleventh.json()).toEqual({ error: 'shipyard_orders_full' });
  });

  it('rejects unmet requirements with 409 requirements_not_met', async () => {
    const cookie = await register();
    seed(1e6);
    const noShipyard = await order(cookie, 'solar-satellite', 1);
    expect(noShipyard.statusCode).toBe(409);
    expect(noShipyard.json()).toEqual({ error: 'requirements_not_met' });

    seed(1e6, { 'orbital-shipyard': 1 });
    // The Interceptor also needs Combustion Drive 1.
    const noDrive = await order(cookie, 'interceptor', 1);
    expect(noDrive.statusCode).toBe(409);
    expect(noDrive.json()).toEqual({ error: 'requirements_not_met' });
  });

  it('rejects an Order it cannot pay for in full with 409 cannot_afford', async () => {
    const cookie = await register();
    seed(3999, { 'orbital-shipyard': 1 });
    const res = await order(cookie, 'solar-satellite', 2); // needs 4000 Crystal
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'cannot_afford' });
  });

  it('rejects an unknown ship with 404 not_found', async () => {
    const cookie = await register();
    const res = await order(cookie, 'death-star', 1);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_found' });
  });

  describe('Shipyard locks', () => {
    function upgrade(cookie: string, key: string) {
      return app.inject({
        method: 'POST',
        url: `/api/structures/${key}/upgrade`,
        headers: { cookie },
        payload: {},
      });
    }

    // The Nanite Foundry needs Robotics Works 10 and Computation 10.
    const NANITE_READY = { 'orbital-shipyard': 2, 'robotics-works': 10 };
    const NANITE_TECH = { computation: 10 };

    for (const key of ['orbital-shipyard', 'nanite-foundry']) {
      it(`refuses to upgrade the ${key} while an Order exists with 409 locked_shipyard_busy`, async () => {
        const cookie = await register();
        seed(1e9, NANITE_READY, NANITE_TECH);
        const placed = (await order(cookie, 'solar-satellite', 2)).json();
        const res = await upgrade(cookie, key);
        expect(res.statusCode).toBe(409);
        expect(res.json()).toEqual({ error: 'locked_shipyard_busy' });

        clock.advance(placed.shipyardOrders[0].endsAt - T0);
        expect((await upgrade(cookie, key)).statusCode).toBe(200);
      });

      it(`refuses Orders while the ${key} upgrades with 409 locked_shipyard_upgrading, until its endsAt`, async () => {
        const cookie = await register();
        seed(1e9, NANITE_READY, NANITE_TECH);
        const endsAt: number = (await upgrade(cookie, key)).json().buildSlots[0].endsAt;
        const res = await order(cookie, 'solar-satellite', 1);
        expect(res.statusCode).toBe(409);
        expect(res.json()).toEqual({ error: 'locked_shipyard_upgrading' });

        clock.advance(endsAt - T0 - 1);
        expect((await order(cookie, 'solar-satellite', 1)).statusCode).toBe(409);
        clock.advance(1);
        expect((await order(cookie, 'solar-satellite', 1)).statusCode).toBe(200);
      });
    }

    it('lets the Nanite Foundry and another Structure occupy both slots at once', async () => {
      const cookie = await register();
      seed(1e9, NANITE_READY, NANITE_TECH);
      expect((await upgrade(cookie, 'nanite-foundry')).statusCode).toBe(200);
      const res = await upgrade(cookie, 'alloy-extractor');
      expect(res.statusCode).toBe(200);
      expect(res.json().buildSlots.map((s: { structure: string }) => s.structure)).toEqual([
        'nanite-foundry',
        'alloy-extractor',
      ]);
    });

    it('does not lock other Structures while an Order exists', async () => {
      const cookie = await register();
      seed(1e9, NANITE_READY, NANITE_TECH);
      await order(cookie, 'solar-satellite', 1);
      expect((await upgrade(cookie, 'robotics-works')).statusCode).toBe(200);
    });
  });

  it('counts combat ships as their units finish', async () => {
    const cookie = await register();
    seed(1e6, { 'orbital-shipyard': 1 }, { 'combustion-drive': 1 });
    await order(cookie, 'interceptor', 5);
    clock.advance(2 * INTERCEPTOR_MS + 10);
    const body = (await getPlanet(cookie)).json();
    expect(body.ships.interceptor).toBe(2);
    expect(body.shipyardOrders[0]).toMatchObject({ completed: 2, quantity: 5 });
    expect(body.nextEventAt).toBe(T0 + 3 * INTERCEPTOR_MS);
  });
});
