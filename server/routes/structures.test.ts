import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.ts';
import { ManualClock } from '../clock.ts';
import { loadConfig } from '../config.ts';

describe('POST /api/structures/:key/upgrade', () => {
  let app: FastifyInstance;
  let clock: ManualClock;

  beforeEach(() => {
    clock = new ManualClock(1_000_000);
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

  function upgrade(cookie: string, key: string) {
    return app.inject({
      method: 'POST',
      url: `/api/structures/${key}/upgrade`,
      headers: { cookie },
      payload: {},
    });
  }

  it('requires a session', async () => {
    const res = await upgrade('', 'alloy-extractor');
    expect(res.statusCode).toBe(401);
  });

  it('deducts the level cost and occupies a Build Slot', async () => {
    const cookie = await register();
    const res = await upgrade(cookie, 'alloy-extractor');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // L1 Alloy Extractor costs 60 Alloy / 15 Crystal.
    expect(body.resources.alloy).toBe(440);
    expect(body.resources.crystal).toBe(485);
    expect(body.buildSlots[0]).toMatchObject({
      slot: 1,
      structure: 'alloy-extractor',
      targetLevel: 1,
      cost: { alloy: 60, crystal: 15, deuterium: 0 },
    });
    expect(body.buildSlots[1]).toBeNull();
    expect(body.fields.inProgress).toBe(1);
    expect(body.nextEventAt).toBe(body.buildSlots[0].endsAt);
  });

  it('rejects a third upgrade with 409 slots_full', async () => {
    const cookie = await register();
    expect((await upgrade(cookie, 'alloy-extractor')).statusCode).toBe(200);
    expect((await upgrade(cookie, 'solar-array')).statusCode).toBe(200);
    const third = await upgrade(cookie, 'crystal-refinery');
    expect(third.statusCode).toBe(409);
    expect(third.json()).toEqual({ error: 'slots_full' });
  });

  it('rejects the same Structure twice with 409 already_in_progress', async () => {
    const cookie = await register();
    expect((await upgrade(cookie, 'alloy-extractor')).statusCode).toBe(200);
    const again = await upgrade(cookie, 'alloy-extractor');
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: 'already_in_progress' });
  });

  it('rejects an unaffordable upgrade with 409 cannot_afford', async () => {
    const cookie = await register();
    // Fusion Reactor L1 costs 900 Alloy; a new Player has 500.
    const res = await upgrade(cookie, 'fusion-reactor');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'cannot_afford' });
  });

  it('rejects an unknown Structure key with 404 not_found', async () => {
    const cookie = await register();
    const res = await upgrade(cookie, 'death-star');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_found' });
  });

  it('finishes past endsAt: the level goes up, the slot frees, and income rises', async () => {
    const cookie = await register();
    const started = (await upgrade(cookie, 'alloy-extractor')).json();
    await upgrade(cookie, 'solar-array');

    const baseRate = started.ratesPerHour.alloy; // 30/h, base income only
    expect(baseRate).toBe(30);

    // Advance well past both short durations (tens of seconds at x1).
    clock.advance(5 * 60_000);
    const after = (
      await app.inject({ method: 'GET', url: '/api/planet', headers: { cookie } })
    ).json();

    expect(after.structures['alloy-extractor']).toBe(1);
    expect(after.structures['solar-array']).toBe(1);
    expect(after.buildSlots).toEqual([null, null]);
    expect(after.fields.used).toBe(2);
    expect(after.fields.inProgress).toBe(0);
    // Alloy income is now higher than base income alone.
    expect(after.ratesPerHour.alloy).toBeGreaterThan(baseRate);
  });
});
