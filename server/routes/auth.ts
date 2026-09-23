import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DUMMY_HASH, verifyPassword } from '../auth/passwords.ts';
import { generateToken, hashToken } from '../auth/tokens.ts';
import { createSession, deleteSession } from '../auth/sessions.ts';
import { validateRegistration } from '../auth/validation.ts';
import { findPlayerByUsernameLower, getPlayer, registerPlayer } from '../players/repo.ts';
import { loadAdvancedPlanet } from '../players/economy.ts';
import { buildPlanetSnapshot } from '../players/snapshot.ts';
import { SESSION_COOKIE, csrf, requireSession, sessionCookieOptions } from './guards.ts';

interface Credentials {
  username: string;
  password: string;
}

// Only the JSON types; the username and password rules are validateRegistration's 400 fields.
const credentialsSchema = {
  body: {
    type: 'object',
    required: ['username', 'password'],
    properties: { username: { type: 'string' }, password: { type: 'string' } },
  },
};

// CSRF runs before the schema, as on the game routes.
const credentialsRoute = { preValidation: csrf, schema: credentialsSchema };

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post(
    '/api/auth/register',
    credentialsRoute,
    (request: FastifyRequest, reply: FastifyReply) => {
      const { username, password } = request.body as Credentials;

      const fields = validateRegistration(username, password);
      if (fields.username || fields.password) {
        return reply.code(400).send({ error: 'validation', fields });
      }
      const display = username.trim();

      if (findPlayerByUsernameLower(app.db, display.toLowerCase())) {
        return reply.code(400).send({ error: 'validation', fields: { username: 'taken' } });
      }

      const token = generateToken();
      const { playerId } = registerPlayer(app.db, {
        username: display,
        password,
        now: app.clock.now(),
        rng: app.rng,
        galaxies: app.config.GALAXIES,
        systems: app.config.SYSTEMS,
        tokenHash: hashToken(token),
      });

      reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions());
      const now = app.clock.now();
      const speed = app.config.UNIVERSE_SPEED;
      const planet = loadAdvancedPlanet(app.db, playerId, now, speed)!;
      return reply.code(201).send({
        player: getPlayer(app.db, playerId),
        snapshot: buildPlanetSnapshot(app.db, planet, { serverNow: now, speed }),
      });
    },
  );

  app.post('/api/auth/login', credentialsRoute, (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = request.body as Credentials;
    const key = username.trim().toLowerCase();

    if (app.loginLimiter.isBlocked(key)) {
      return reply.code(429).send({ error: 'too_many_attempts' });
    }

    const player = findPlayerByUsernameLower(app.db, key);
    // Run scrypt even for an unknown user so timing doesn't reveal which usernames exist.
    const ok = player
      ? verifyPassword(password, player.password_hash)
      : verifyPassword(password, DUMMY_HASH);
    if (!player || !ok) {
      app.loginLimiter.recordFailure(key);
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    app.loginLimiter.reset(key);
    const token = generateToken();
    createSession(app.db, hashToken(token), player.id, app.clock.now());
    reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions());
    return reply.code(200).send({ player: getPlayer(app.db, player.id) });
  });

  app.post(
    '/api/auth/logout',
    { onRequest: requireSession, preValidation: csrf },
    (request: FastifyRequest, reply: FastifyReply) => {
      deleteSession(app.db, hashToken(request.cookies[SESSION_COOKIE]!));
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      return reply.code(204).send();
    },
  );

  app.get(
    '/api/auth/me',
    { onRequest: requireSession },
    (request: FastifyRequest, reply: FastifyReply) => {
      const player = getPlayer(app.db, request.playerId);
      if (!player) return reply.code(401).send({ error: 'unauthenticated' });
      return reply.send({ player });
    },
  );
}
