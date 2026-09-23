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
    // Research Lab L1 costs 200 Deuterium; a new Player has 0.
    const res = await upgrade(cookie, 'research-lab');
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

  function setLevel(key: string, level: number) {
    app.db
      .prepare(
        `INSERT INTO planet_structures (planet_id, structure_key, level) VALUES (1, ?, ?)
           ON CONFLICT(planet_id, structure_key) DO UPDATE SET level = excluded.level`,
      )
      .run(key, level);
  }

  function setTechLevel(key: string, level: number) {
    app.db
      .prepare(
        `INSERT INTO player_technologies (player_id, technology_key, level) VALUES (1, ?, ?)`,
      )
      .run(key, level);
  }

  function setResources(amount: number) {
    app.db
      .prepare(`UPDATE planets SET alloy = ?, crystal = ?, deuterium = ? WHERE id = 1`)
      .run(amount, amount, amount);
  }

  async function planet(cookie: string) {
    return (await app.inject({ method: 'GET', url: '/api/planet', headers: { cookie } })).json();
  }

  it('rejects an upgrade whose requirements are not met with 409 requirements_not_met', async () => {
    const cookie = await register();
    setResources(10_000);
    // Orbital Shipyard requires Robotics Works 2; the new Player has none.
    const res = await upgrade(cookie, 'orbital-shipyard');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'requirements_not_met' });
  });

  it('counts only finished levels for requirements, not a level still being built', async () => {
    const cookie = await register();
    setResources(10_000);
    setLevel('robotics-works', 1);
    expect((await upgrade(cookie, 'robotics-works')).statusCode).toBe(200); // → 2, in progress
    const res = await upgrade(cookie, 'orbital-shipyard');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'requirements_not_met' });
  });

  it('allows an upgrade once Structure and Technology requirements are met', async () => {
    const cookie = await register();
    setResources(100_000);
    setLevel('deuterium-synthesizer', 5);
    setTechLevel('energy-theory', 3);
    const res = await upgrade(cookie, 'fusion-reactor');
    expect(res.statusCode).toBe(200);
    expect(res.json().technologies['energy-theory']).toBe(3);
  });

  it('counts in-progress upgrades against the Fields limit (409 fields_full)', async () => {
    const cookie = await register();
    setResources(10_000);
    setLevel('research-lab', 162); // 162 of 163 Fields used
    expect((await upgrade(cookie, 'alloy-extractor')).statusCode).toBe(200); // 162 + 1 in progress
    const res = await upgrade(cookie, 'crystal-refinery');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'fields_full' });
  });

  it('needs 1000 Energy produced for Terraformer 1, checked not spent (409 insufficient_energy)', async () => {
    const cookie = await register();
    setResources(1_000_000);
    setLevel('nanite-foundry', 1);
    setTechLevel('energy-theory', 12);
    setLevel('solar-array', 13); // 897 Energy
    const res = await upgrade(cookie, 'terraformer');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'insufficient_energy' });

    setLevel('solar-array', 14); // 1063 Energy
    const ok = await upgrade(cookie, 'terraformer');
    expect(ok.statusCode).toBe(200);
    expect(ok.json().energy.produced).toBe(1063);
  });

  it('raises max Fields by the Terraformer bonus 5·L + floor(L/2)', async () => {
    const cookie = await register();
    expect((await planet(cookie)).fields.max).toBe(163);
    setLevel('terraformer', 3);
    const after = await planet(cookie);
    expect(after.fields.max).toBe(163 + 15 + 1);
    expect(after.fields.used).toBe(3);
  });

  it('lets a Terraformer-raised max admit an upgrade the base Fields would refuse', async () => {
    const cookie = await register();
    setResources(10_000);
    setLevel('research-lab', 162);
    setLevel('terraformer', 1); // used 163, max 163 + 5 = 168
    expect((await upgrade(cookie, 'alloy-extractor')).statusCode).toBe(200);
  });
});

describe('POST /api/build-slots/:slot/cancel', () => {
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

  function post(cookie: string, url: string) {
    return app.inject({ method: 'POST', url, headers: { cookie }, payload: {} });
  }

  it('requires a session', async () => {
    const res = await post('', '/api/build-slots/1/cancel');
    expect(res.statusCode).toBe(401);
  });

  it('refunds exactly the paid cost, frees the slot and returns the Field', async () => {
    const cookie = await register();
    const started = (await post(cookie, '/api/structures/alloy-extractor/upgrade')).json();
    expect(started.fields.inProgress).toBe(1);

    const res = await post(cookie, '/api/build-slots/1/cancel');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // No time passed: back to exactly the starting 500 / 500 / 0.
    expect(body.resources).toEqual({ alloy: 500, crystal: 500, deuterium: 0 });
    expect(body.buildSlots).toEqual([null, null]);
    expect(body.fields.inProgress).toBe(0);
    expect(body.fields.used).toBe(0);
    expect(body.structures['alloy-extractor']).toBe(0);
    expect(body.nextEventAt).toBeNull();
  });

  it('refunds the cost on top of production earned since the start', async () => {
    const cookie = await register();
    await post(cookie, '/api/structures/solar-array/upgrade'); // 75 / 30, slot 1
    await post(cookie, '/api/structures/alloy-extractor/upgrade'); // 60 / 15, slot 2
    clock.advance(1000); // 1s of base income, still well before either finishes
    const body = (await post(cookie, '/api/build-slots/2/cancel')).json();
    expect(body.buildSlots[0]).toMatchObject({ structure: 'solar-array' });
    expect(body.buildSlots[1]).toBeNull();
    // 500 − 75 − 60 + 60 refund + 30/h · 1s
    expect(body.resources.alloy).toBeCloseTo(425 + 30 / 3600, 9);
    expect(body.resources.crystal).toBeCloseTo(470 + 15 / 3600, 9);
  });

  it('rejects Cancel on an empty slot with 409 not_found', async () => {
    const cookie = await register();
    const res = await post(cookie, '/api/build-slots/2/cancel');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'not_found' });
  });

  it('rejects Cancel on an upgrade that has already finished with 409 not_found', async () => {
    const cookie = await register();
    await post(cookie, '/api/structures/alloy-extractor/upgrade');
    clock.advance(5 * 60_000);
    const res = await post(cookie, '/api/build-slots/1/cancel');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'not_found' });
  });

  it('rejects a slot number outside 1–2 with 409 not_found', async () => {
    const cookie = await register();
    const res = await post(cookie, '/api/build-slots/3/cancel');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'not_found' });
  });
});
