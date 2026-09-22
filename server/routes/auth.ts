import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DUMMY_HASH, verifyPassword } from '../auth/passwords.ts';
import { generateToken, hashToken } from '../auth/tokens.ts';
import { createSession, deleteSession } from '../auth/sessions.ts';
import { validateRegistration } from '../auth/validation.ts';
import { findPlayerByUsernameLower, getPlayer, registerPlayer } from '../players/repo.ts';
import { loadAdvancedPlanet } from '../players/economy.ts';
import { buildPlanetSnapshot } from '../players/snapshot.ts';
import { SESSION_COOKIE, passesCsrf, resolvePlayerId, sessionCookieOptions } from './guards.ts';

interface Credentials {
  username?: unknown;
  password?: unknown;
}

/** The `{ player, planet }` payload returned after auth and by /api/auth/me. */
function sessionPayload(app: FastifyInstance, playerId: number) {
  const player = getPlayer(app.db, playerId);
  if (!player) return null;
  const now = app.clock.now();
  const speed = app.config.UNIVERSE_SPEED;
  const planet = loadAdvancedPlanet(app.db, playerId, now, speed);
  if (!planet) return null;
  return { player, planet: buildPlanetSnapshot(app.db, planet, { serverNow: now, speed }) };
}

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post('/api/auth/register', (request: FastifyRequest, reply: FastifyReply) => {
    if (!passesCsrf(request, reply)) return;
    const { username, password } = (request.body ?? {}) as Credentials;

    const fields = validateRegistration(username, password);
    if (fields.username || fields.password) {
      return reply.code(400).send({ error: 'validation', fields });
    }
    const display = (username as string).trim();

    if (findPlayerByUsernameLower(app.db, display.toLowerCase())) {
      return reply.code(400).send({ error: 'validation', fields: { username: 'taken' } });
    }

    const token = generateToken();
    const { playerId } = registerPlayer(app.db, {
      username: display,
      password: password as string,
      now: app.clock.now(),
      rng: app.rng,
      galaxies: app.config.GALAXIES,
      systems: app.config.SYSTEMS,
      tokenHash: hashToken(token),
    });

    reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions());
    return reply.code(201).send({ ...sessionPayload(app, playerId), firstLogin: true });
  });

  app.post('/api/auth/login', (request: FastifyRequest, reply: FastifyReply) => {
    if (!passesCsrf(request, reply)) return;
    const { username, password } = (request.body ?? {}) as Credentials;
    const key = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const pw = typeof password === 'string' ? password : '';

    if (app.loginLimiter.isBlocked(key)) {
      return reply.code(429).send({ error: 'too_many_attempts' });
    }

    const player = findPlayerByUsernameLower(app.db, key);
    // Run scrypt even for an unknown user so timing doesn't reveal which usernames exist.
    const ok = player ? verifyPassword(pw, player.password_hash) : verifyPassword(pw, DUMMY_HASH);
    if (!player || !ok) {
      app.loginLimiter.recordFailure(key);
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    app.loginLimiter.reset(key);
    const token = generateToken();
    createSession(app.db, hashToken(token), player.id, app.clock.now());
    reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions());
    return reply.code(200).send(sessionPayload(app, player.id));
  });

  app.post('/api/auth/logout', (request: FastifyRequest, reply: FastifyReply) => {
    if (!passesCsrf(request, reply)) return;
    const token = request.cookies[SESSION_COOKIE];
    if (token) deleteSession(app.db, hashToken(token));
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(200).send({ ok: true });
  });

  app.get('/api/auth/me', (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = resolvePlayerId(request);
    if (playerId === null) return reply.code(401).send({ error: 'unauthenticated' });
    return reply.send(sessionPayload(app, playerId));
  });
}
