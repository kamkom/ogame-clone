import type { DatabaseSync } from 'node:sqlite';

// Opaque-token sessions with a 30-day sliding expiry. The table stores the token's SHA-256
// (see tokens.ts). Expiry slides forward on use, but the row is rewritten at most once a day
// so a busy Player doesn't cause a write on every request.

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SLIDE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

interface SessionRow {
  player_id: number;
  expires_at: number;
}

/** Insert a session for `playerId` keyed by `tokenHash`, expiring 30 days out. */
export function createSession(
  db: DatabaseSync,
  tokenHash: string,
  playerId: number,
  now: number,
): void {
  db.prepare(
    `INSERT INTO sessions (token_hash, player_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`,
  ).run(tokenHash, playerId, now, now + SESSION_TTL_MS);
}

/**
 * Resolve a token hash to its Player, or null when missing or expired. On a hit, slide the
 * expiry forward — but only write when at least a day has passed since the last slide.
 */
export function lookupSession(db: DatabaseSync, tokenHash: string, now: number): number | null {
  const row = db
    .prepare(`SELECT player_id, expires_at FROM sessions WHERE token_hash = ?`)
    .get(tokenHash) as SessionRow | undefined;

  if (!row || row.expires_at <= now) return null;

  const lastSlide = row.expires_at - SESSION_TTL_MS;
  if (now - lastSlide >= SLIDE_INTERVAL_MS) {
    db.prepare(`UPDATE sessions SET expires_at = ? WHERE token_hash = ?`).run(
      now + SESSION_TTL_MS,
      tokenHash,
    );
  }
  return row.player_id;
}

/** Delete a single session (logout). */
export function deleteSession(db: DatabaseSync, tokenHash: string): void {
  db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
}

/** Sweep every expired session — run at startup (spec story 93). Returns the count removed. */
export function sweepExpiredSessions(db: DatabaseSync, now: number): number {
  const result = db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(now);
  return Number(result.changes);
}
