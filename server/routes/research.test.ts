import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.ts';
import { ManualClock } from '../clock.ts';
import { loadConfig } from '../config.ts';
import { researchDurationSec } from '#shared/economy.ts';

const T0 = 1_000_000;
// Energy Theory L1 (0 / 800) takes 1440 s at Lab 1; L2 (0 / 1600) takes 2880 s.
const E1_MS = 1_440_000;
const E2_MS = 2_880_000;

describe('POST /api/research', () => {
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

  // Test setup only: give the Planet a stock and built Structure levels directly.
  function seed(resources: number, structures: Record<string, number> = {}): void {
    app.db
      .prepare(`UPDATE planets SET alloy = ?, crystal = ?, deuterium = ?`)
      .run(resources, resources, resources);
    const { id } = app.db.prepare(`SELECT id FROM planets`).get() as { id: number };
    for (const [key, level] of Object.entries(structures)) {
      app.db
        .prepare(`INSERT INTO planet_structures (planet_id, structure_key, level) VALUES (?, ?, ?)`)
        .run(id, key, level);
    }
  }

  function enqueue(cookie: string, technology: unknown) {
    return app.inject({
      method: 'POST',
      url: '/api/research',
      headers: { cookie },
      payload: { technology },
    });
  }

  function upgrade(cookie: string, key: string) {
    return app.inject({
      method: 'POST',
      url: `/api/structures/${key}/upgrade`,
      headers: { cookie },
      payload: {},
    });
  }

  function cancel(cookie: string, entryId: unknown) {
    return app.inject({
      method: 'POST',
      url: `/api/research/${entryId}/cancel`,
      headers: { cookie },
      payload: {},
    });
  }

  function getPlanet(cookie: string) {
    return app.inject({ method: 'GET', url: '/api/planet', headers: { cookie } });
  }

  it('requires a session', async () => {
    const res = await enqueue('', 'energy-theory');
    expect(res.statusCode).toBe(401);
  });

  it('lists every Technology at level 0 and an empty queue in the snapshot', async () => {
    const cookie = await register();
    const body = (await getPlanet(cookie)).json();
    expect(Object.keys(body.technologies)).toHaveLength(16);
    expect(body.technologies['fold-drive']).toBe(0);
    expect(body.researchQueue).toEqual([]);
  });

  it('pays at enqueue and starts the first entry at once, its duration from the Lab', async () => {
    const cookie = await register();
    seed(10_000, { 'research-lab': 1 });
    const res = await enqueue(cookie, 'energy-theory');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.resources).toEqual({ alloy: 10_000, crystal: 9200, deuterium: 9600 });
    expect(body.researchQueue).toEqual([
      {
        id: expect.any(Number),
        technology: 'energy-theory',
        targetLevel: 1,
        cost: { alloy: 0, crystal: 800, deuterium: 400 },
        startedAt: T0,
        endsAt: T0 + E1_MS,
        waitingOnLab: false,
      },
    ]);
    expect(body.technologies['energy-theory']).toBe(0);
    expect(body.nextEventAt).toBe(T0 + E1_MS);
  });

  it('gives two entries of the same Technology consecutive levels and prices', async () => {
    const cookie = await register();
    seed(10_000, { 'research-lab': 1 });
    await enqueue(cookie, 'energy-theory');
    const res = await enqueue(cookie, 'energy-theory');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.researchQueue[1]).toMatchObject({
      technology: 'energy-theory',
      targetLevel: 2,
      cost: { alloy: 0, crystal: 1600, deuterium: 800 },
      startedAt: null,
      endsAt: null,
    });
    expect(body.resources.crystal).toBe(10_000 - 800 - 1600);
    expect(body.resources.deuterium).toBe(10_000 - 400 - 800);
  });

  it('rejects a 6th entry with 409 research_queue_full', async () => {
    const cookie = await register();
    seed(10_000_000, { 'research-lab': 1 });
    for (let i = 0; i < 5; i++) {
      expect((await enqueue(cookie, 'energy-theory')).statusCode).toBe(200);
    }
    const sixth = await enqueue(cookie, 'computation');
    expect(sixth.statusCode).toBe(409);
    expect(sixth.json()).toEqual({ error: 'research_queue_full' });
  });

  it('counts an earlier queue entry toward a Technology requirement', async () => {
    const cookie = await register();
    seed(10_000, { 'research-lab': 1 });
    // Photon Lasers needs Energy Theory 2.
    const early = await enqueue(cookie, 'photon-lasers');
    expect(early.statusCode).toBe(409);
    expect(early.json()).toEqual({ error: 'requirements_not_met' });

    await enqueue(cookie, 'energy-theory');
    await enqueue(cookie, 'energy-theory');
    const res = await enqueue(cookie, 'photon-lasers');
    expect(res.statusCode).toBe(200);
    expect(res.json().researchQueue[2]).toMatchObject({ technology: 'photon-lasers' });
  });

  it('rejects a Structure requirement that is still in progress with 409', async () => {
    const cookie = await register();
    seed(10_000);
    const lab = await app.inject({
      method: 'POST',
      url: '/api/structures/research-lab/upgrade',
      headers: { cookie },
      payload: {},
    });
    expect(lab.statusCode).toBe(200);
    const res = await enqueue(cookie, 'energy-theory');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'requirements_not_met' });
  });

  it('rejects an unaffordable entry with 409 cannot_afford', async () => {
    const cookie = await register();
    seed(300, { 'research-lab': 1 }); // Energy Theory needs 800 Crystal
    const res = await enqueue(cookie, 'energy-theory');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'cannot_afford' });
  });

  it('rejects an unknown Technology with 404 not_found and a missing one with 400', async () => {
    const cookie = await register();
    const unknown = await enqueue(cookie, 'time-travel');
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toEqual({ error: 'not_found' });
    const missing = await app.inject({
      method: 'POST',
      url: '/api/research',
      headers: { cookie },
      payload: {},
    });
    expect(missing.statusCode).toBe(400);
  });

  it('completes the queue in order, each next entry starting at the boundary', async () => {
    const cookie = await register();
    seed(10_000, { 'research-lab': 1 });
    await enqueue(cookie, 'energy-theory');
    await enqueue(cookie, 'energy-theory');

    clock.advance(E1_MS + 60_000);
    const mid = (await getPlanet(cookie)).json();
    expect(mid.technologies['energy-theory']).toBe(1);
    expect(mid.researchQueue).toEqual([
      expect.objectContaining({
        targetLevel: 2,
        startedAt: T0 + E1_MS,
        endsAt: T0 + E1_MS + E2_MS,
      }),
    ]);
    expect(mid.nextEventAt).toBe(T0 + E1_MS + E2_MS);

    clock.advance(E2_MS);
    const done = (await getPlanet(cookie)).json();
    expect(done.technologies['energy-theory']).toBe(2);
    expect(done.researchQueue).toEqual([]);
  });

  it('starts a new entry at now once the queue has emptied', async () => {
    const cookie = await register();
    seed(10_000, { 'research-lab': 1 });
    await enqueue(cookie, 'energy-theory');
    clock.advance(E1_MS * 3);
    const res = (await enqueue(cookie, 'computation')).json();
    expect(res.researchQueue).toEqual([
      expect.objectContaining({ technology: 'computation', startedAt: clock.now() }),
    ]);
  });

  describe('Research Lab lock', () => {
    it('refuses a Lab upgrade while Research is active with 409 locked_research_active', async () => {
      const cookie = await register();
      seed(10_000, { 'research-lab': 1 });
      await enqueue(cookie, 'energy-theory');
      const res = await upgrade(cookie, 'research-lab');
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'locked_research_active' });

      clock.advance(E1_MS);
      expect((await upgrade(cookie, 'research-lab')).statusCode).toBe(200);
    });

    it('holds Research queued during a Lab upgrade until the Lab finishes, at the new level', async () => {
      const cookie = await register();
      seed(10_000, { 'research-lab': 1 });
      const lab = (await upgrade(cookie, 'research-lab')).json();
      const labEndsAt: number = lab.buildSlots[0].endsAt;

      const res = await enqueue(cookie, 'energy-theory');
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.researchQueue).toEqual([
        expect.objectContaining({ startedAt: null, endsAt: null, waitingOnLab: true }),
      ]);
      expect(body.nextEventAt).toBe(labEndsAt);

      clock.advance(labEndsAt - T0 + 1000);
      const after = (await getPlanet(cookie)).json();
      expect(after.structures['research-lab']).toBe(2);
      expect(after.researchQueue).toEqual([
        expect.objectContaining({
          startedAt: labEndsAt,
          endsAt: labEndsAt + researchDurationSec(0, 800, 2, 1) * 1000,
          waitingOnLab: false,
        }),
      ]);
    });

    it('starts the waiting head at once when the Lab upgrade is cancelled', async () => {
      const cookie = await register();
      seed(10_000, { 'research-lab': 1 });
      await upgrade(cookie, 'research-lab');
      await enqueue(cookie, 'energy-theory');

      clock.advance(60_000);
      const res = await app.inject({
        method: 'POST',
        url: '/api/build-slots/1/cancel',
        headers: { cookie },
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      const endsAt = clock.now() + researchDurationSec(0, 800, 1, 1) * 1000;
      expect(body.researchQueue).toEqual([
        expect.objectContaining({ startedAt: clock.now(), endsAt, waitingOnLab: false }),
      ]);
      expect(body.nextEventAt).toBe(endsAt);
    });
  });

  describe('POST /api/research/:entryId/cancel', () => {
    it('refunds the head in full and starts the next entry at now', async () => {
      const cookie = await register();
      seed(10_000, { 'research-lab': 1 });
      const first = (await enqueue(cookie, 'energy-theory')).json().researchQueue[0];
      await enqueue(cookie, 'computation');

      clock.advance(60_000);
      const before = (await getPlanet(cookie)).json();
      const res = await cancel(cookie, first.id);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.resources).toEqual({
        alloy: before.resources.alloy,
        crystal: before.resources.crystal + 800,
        deuterium: before.resources.deuterium + 400,
      });
      // Computation L1 (0 / 400) takes 720 s at Lab 1.
      expect(body.researchQueue).toEqual([
        expect.objectContaining({
          technology: 'computation',
          startedAt: clock.now(),
          endsAt: clock.now() + 720_000,
        }),
      ]);
      expect(body.technologies['energy-theory']).toBe(0);
    });

    it('cascades to the waiting entries that relied on it and refunds them all', async () => {
      const cookie = await register();
      seed(10_000, { 'research-lab': 1 });
      const e1 = (await enqueue(cookie, 'energy-theory')).json().researchQueue[0];
      await enqueue(cookie, 'energy-theory'); // L2 builds on L1
      await enqueue(cookie, 'photon-lasers'); // needs Energy Theory 2
      await enqueue(cookie, 'computation'); // independent

      const res = await cancel(cookie, e1.id);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.researchQueue).toEqual([
        expect.objectContaining({ technology: 'computation', startedAt: T0 }),
      ]);
      // Everything but Computation (0 / 400 / 600) is back.
      expect(body.resources).toEqual({ alloy: 10_000, crystal: 9600, deuterium: 9400 });
    });

    it('cancels a waiting entry and its dependants, leaving the head running', async () => {
      const cookie = await register();
      seed(10_000, { 'research-lab': 1 });
      await enqueue(cookie, 'energy-theory');
      const e2 = (await enqueue(cookie, 'energy-theory')).json().researchQueue[1];
      await enqueue(cookie, 'photon-lasers');
      await enqueue(cookie, 'computation');

      const body = (await cancel(cookie, e2.id)).json();
      expect(body.researchQueue).toEqual([
        expect.objectContaining({ technology: 'energy-theory', targetLevel: 1, startedAt: T0 }),
        expect.objectContaining({ technology: 'computation', startedAt: null }),
      ]);
      expect(body.resources).toEqual({ alloy: 10_000, crystal: 8800, deuterium: 9000 });
    });

    it('keeps a waiting head on hold when the Lab is upgrading', async () => {
      const cookie = await register();
      seed(10_000, { 'research-lab': 1 });
      await upgrade(cookie, 'research-lab');
      const e1 = (await enqueue(cookie, 'energy-theory')).json().researchQueue[0];
      await enqueue(cookie, 'computation');
      const body = (await cancel(cookie, e1.id)).json();
      expect(body.researchQueue).toEqual([
        expect.objectContaining({ technology: 'computation', startedAt: null, waitingOnLab: true }),
      ]);
    });

    it('rejects an unknown or finished entry with 409 not_found', async () => {
      const cookie = await register();
      seed(10_000, { 'research-lab': 1 });
      const e1 = (await enqueue(cookie, 'energy-theory')).json().researchQueue[0];
      clock.advance(E1_MS);
      const finished = await cancel(cookie, e1.id);
      expect(finished.statusCode).toBe(409);
      expect(finished.json()).toEqual({ error: 'not_found' });
      expect((await cancel(cookie, 9999)).statusCode).toBe(409);
      expect((await cancel(cookie, 'abc')).statusCode).toBe(409);
      expect((await cancel('', e1.id)).statusCode).toBe(401);
    });
  });

  describe('Graviton Lance', () => {
    // Needs Research Lab 12 and 300,000 Energy capacity. A Solar Array 50 makes ~117k, 60 ~365k.
    it('rejects below 300,000 Energy capacity with 409 insufficient_energy', async () => {
      const cookie = await register();
      seed(10_000, { 'research-lab': 12, 'solar-array': 50 });
      const res = await enqueue(cookie, 'graviton-lance');
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'insufficient_energy' });
    });

    it('queues with zero cost at or above 300,000 Energy, spending no Energy', async () => {
      const cookie = await register();
      seed(10_000, { 'research-lab': 12, 'solar-array': 60 });
      const res = await enqueue(cookie, 'graviton-lance');
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.energy.produced).toBeGreaterThanOrEqual(300_000);
      expect(body.resources).toEqual({ alloy: 10_000, crystal: 10_000, deuterium: 10_000 });
      expect(body.researchQueue).toEqual([
        expect.objectContaining({
          technology: 'graviton-lance',
          targetLevel: 1,
          cost: { alloy: 0, crystal: 0, deuterium: 0 },
          startedAt: T0,
        }),
      ]);
      // Level 2 needs three times the Energy (900,000).
      const second = await enqueue(cookie, 'graviton-lance');
      expect(second.json()).toEqual({ error: 'insufficient_energy' });
    });
  });
});
