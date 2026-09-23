import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../app.ts';
import { ManualClock } from '../clock.ts';
import { loadConfig } from '../config.ts';
import { SESSION_TTL_MS } from '../auth/sessions.ts';

const DAY = 24 * 60 * 60 * 1000;

/** A deterministic rng cycling through fixed values. */
function cycle(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

function json(
  app: FastifyInstance,
  method: 'POST',
  url: string,
  body: object | string,
  cookie?: string,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method,
    url,
    payload: body,
    headers: cookie ? { cookie } : {},
  });
}

/** Pull the `session=` cookie out of a Set-Cookie response. */
function sessionCookie(res: LightMyRequestResponse): string {
  const c = res.cookies.find((c) => c.name === 'session');
  return c ? `session=${c.value}` : '';
}

describe('auth routes', () => {
  let app: FastifyInstance;
  let clock: ManualClock;

  beforeEach(() => {
    clock = new ManualClock(1_000_000);
    const config = loadConfig({ SERVE_WEB: 'false' });
    app = buildApp({ dbPath: ':memory:', clock, config, rng: cycle([0.1, 0.2, 0.3, 0.4]) });
  });
  afterEach(async () => {
    await app.close();
  });

  it('registers → 201 with a session cookie and Planet snapshot', async () => {
    const res = await json(app, 'POST', '/api/auth/register', {
      username: 'Vega',
      password: 'password1',
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.player.username).toBe('Vega');
    expect(body.snapshot.planet.name).toBe('Homeworld');
    expect(body.snapshot.resources).toEqual({ alloy: 500, crystal: 500, deuterium: 0 });
    const cookie = res.cookies.find((c) => c.name === 'session')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
  });

  it('rejects a duplicate username in a different casing → 400', async () => {
    await json(app, 'POST', '/api/auth/register', { username: 'Vega', password: 'password1' });
    const res = await json(app, 'POST', '/api/auth/register', {
      username: 'VEGA',
      password: 'password1',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().fields.username).toBe('taken');
  });

  it('returns inline field errors for a bad username/password', async () => {
    const res = await json(app, 'POST', '/api/auth/register', {
      username: 'no',
      password: 'short',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().fields).toEqual({ username: 'invalid', password: 'length' });
  });

  it('logs in with the right password', async () => {
    await json(app, 'POST', '/api/auth/register', { username: 'Vega', password: 'password1' });
    const res = await json(app, 'POST', '/api/auth/login', {
      username: 'vega',
      password: 'password1',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().player.username).toBe('Vega');
  });

  it('treats a wrong password and an unknown user the same → 401 invalid_credentials', async () => {
    await json(app, 'POST', '/api/auth/register', { username: 'Vega', password: 'password1' });
    const wrong = await json(app, 'POST', '/api/auth/login', {
      username: 'Vega',
      password: 'nope-nope',
    });
    const unknown = await json(app, 'POST', '/api/auth/login', {
      username: 'Nobody',
      password: 'password1',
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual({ error: 'invalid_credentials' });
    expect(unknown.json()).toEqual({ error: 'invalid_credentials' });
  });

  it('blocks the 11th failure with 429, then clears after 15 minutes', async () => {
    await json(app, 'POST', '/api/auth/register', { username: 'Vega', password: 'password1' });
    for (let i = 0; i < 10; i++) {
      const r = await json(app, 'POST', '/api/auth/login', {
        username: 'Vega',
        password: 'x'.repeat(8),
      });
      expect(r.statusCode).toBe(401);
    }
    const blocked = await json(app, 'POST', '/api/auth/login', {
      username: 'Vega',
      password: 'password1',
    });
    expect(blocked.statusCode).toBe(429);

    clock.advance(15 * 60 * 1000 + 1);
    const after = await json(app, 'POST', '/api/auth/login', {
      username: 'Vega',
      password: 'password1',
    });
    expect(after.statusCode).toBe(200);
  });

  it('logout deletes only the current session', async () => {
    const reg = await json(app, 'POST', '/api/auth/register', {
      username: 'Vega',
      password: 'password1',
    });
    const cookieA = sessionCookie(reg);
    // A second session for the same Player via login.
    const login = await json(app, 'POST', '/api/auth/login', {
      username: 'Vega',
      password: 'password1',
    });
    const cookieB = sessionCookie(login);

    const out = await json(app, 'POST', '/api/auth/logout', {}, cookieA);
    expect(out.statusCode).toBe(204);

    const meA = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: cookieA },
    });
    const meB = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: cookieB },
    });
    expect(meA.statusCode).toBe(401);
    expect(meB.statusCode).toBe(200);
  });

  it('keeps a session across a reload and slides its expiry', async () => {
    const reg = await json(app, 'POST', '/api/auth/register', {
      username: 'Vega',
      password: 'password1',
    });
    const cookie = sessionCookie(reg);

    // Use it 29 days in — slides expiry forward.
    clock.set(1_000_000 + 29 * DAY);
    const mid = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(mid.statusCode).toBe(200);

    // Past the original 30-day mark, still valid thanks to the slide.
    clock.set(1_000_000 + SESSION_TTL_MS + DAY);
    const late = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(late.statusCode).toBe(200);
  });

  it('re-sends the cookie so the browser keeps it 30 days after the last visit', async () => {
    const reg = await json(app, 'POST', '/api/auth/register', {
      username: 'Vega',
      password: 'password1',
    });
    const cookie = sessionCookie(reg);

    clock.set(1_000_000 + 10 * DAY);
    const res = await app.inject({ method: 'GET', url: '/api/planet', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const slid = res.cookies.find((c) => c.name === 'session');
    expect(slid?.value).toBe(cookie.slice('session='.length));
    expect(slid?.maxAge).toBe(SESSION_TTL_MS / 1000);
    expect(slid?.httpOnly).toBe(true);
  });

  it('expires a session left idle for 30 days', async () => {
    const reg = await json(app, 'POST', '/api/auth/register', {
      username: 'Vega',
      password: 'password1',
    });
    const cookie = sessionCookie(reg);

    clock.set(1_000_000 + SESSION_TTL_MS);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(401);
    const planet = await app.inject({ method: 'GET', url: '/api/planet', headers: { cookie } });
    expect(planet.statusCode).toBe(401);
  });

  it('rejects a foreign Origin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'Vega', password: 'password1' },
      headers: { origin: 'http://evil.example', host: 'localhost:3000' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects a non-JSON body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: 'username=Vega&password=password1',
      headers: { 'content-type': 'text/plain' },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});
