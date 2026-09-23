import type { FastifyReply, FastifyRequest } from 'fastify';
import { hashToken } from '../auth/tokens.ts';
import { lookupSession, SESSION_TTL_MS } from '../auth/sessions.ts';

export const SESSION_COOKIE = 'session';
const SESSION_COOKIE_MAX_AGE_S = Math.floor(SESSION_TTL_MS / 1000);

/** Options for the session cookie: HttpOnly, SameSite=Lax, path-wide, 30-day max-age. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_S,
  };
}

/** The host portion of an `Origin` header, or null when it can't be parsed. */
function originHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

/**
 * CSRF guard for mutating routes: a present `Origin` must match the request host, and the body
 * must be JSON. Returns true when the request is allowed; otherwise it has already replied.
 */
export function passesCsrf(request: FastifyRequest, reply: FastifyReply): boolean {
  const origin = request.headers.origin;
  // A malformed Origin yields a null host, which never matches and so is rejected too.
  if (origin && originHost(origin) !== request.headers.host) {
    reply.code(403).send({ error: 'forbidden_origin' });
    return false;
  }

  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.includes('application/json')) {
    reply.code(415).send({ error: 'unsupported_media_type' });
    return false;
  }
  return true;
}

/**
 * Resolve the session cookie to a player id, sliding the expiry. Null when absent/expired. On a
 * hit the cookie is sent again, so the browser keeps it 30 days after the last visit too.
 */
export function resolvePlayerId(request: FastifyRequest, reply: FastifyReply): number | null {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  const playerId = lookupSession(request.server.db, hashToken(token), request.server.clock.now());
  if (playerId !== null) reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions());
  return playerId;
}
