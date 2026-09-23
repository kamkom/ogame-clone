import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.ts';
import { ManualClock } from '../clock.ts';
import { loadConfig } from '../config.ts';

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
});
