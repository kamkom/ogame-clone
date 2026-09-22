import type { FastifyReply, FastifyRequest } from 'fastify';
import { hashToken } from '../auth/tokens.ts';
import { lookupSession } from '../auth/sessions.ts';
import { SESSION_TTL_MS } from '../auth/sessions.ts';

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

/**
 * CSRF guard for mutating routes: a present `Origin` must match the request host, and the body
 * must be JSON. Returns true when the request is allowed; otherwise it has already replied.
 */
export function passesCsrf(request: FastifyRequest, reply: FastifyReply): boolean {
  const origin = request.headers.origin;
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      reply.code(403).send({ error: 'forbidden_origin' });
      return false;
    }
    if (originHost !== request.headers.host) {
      reply.code(403).send({ error: 'forbidden_origin' });
      return false;
    }
  }

  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.includes('application/json')) {
    reply.code(415).send({ error: 'unsupported_media_type' });
    return false;
  }
  return true;
}

/** Resolve the session cookie to a player id, sliding the expiry. Null when absent/expired. */
export function resolvePlayerId(request: FastifyRequest): number | null {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  return lookupSession(request.server.db, hashToken(token), request.server.clock.now());
}
