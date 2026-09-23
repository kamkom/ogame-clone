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
 * CSRF guard for mutating routes, run as a `preValidation` hook (after `requireSession`, before
 * the JSON schema): a present `Origin` must match the request host, and the body must be JSON.
 */
export async function csrf(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const origin = request.headers.origin;
  // A malformed Origin yields a null host, which never matches and so is rejected too.
  if (origin && originHost(origin) !== request.headers.host) {
    return reply.code(403).send({ error: 'forbidden_origin' });
  }

  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.includes('application/json')) {
    return reply.code(415).send({ error: 'unsupported_media_type' });
  }
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

/**
 * The session guard, run as an `onRequest` hook so it answers before anything else: every route
 * except register/login is 401 without a session, whatever its Origin or body. Sets
 * `request.playerId` for the handler.
 */
export async function requireSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const playerId = resolvePlayerId(request, reply);
  if (playerId === null) return reply.code(401).send({ error: 'unauthenticated' });
  request.playerId = playerId;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** The signed-in Player; set by `requireSession`. */
    playerId: number;
  }
}
