import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { open } from '../db/open.ts';
import {
  SESSION_TTL_MS,
  createSession,
  deleteSession,
  lookupSession,
  sweepExpiredSessions,
} from './sessions.ts';

const DAY = 24 * 60 * 60 * 1000;

/** A player row is needed for the sessions FK. */
function seedPlayer(db: DatabaseSync, id: number): void {
  db.prepare(
    `INSERT INTO players (id, username, username_lower, password_hash, created_at)
     VALUES (?, ?, ?, ?, 0)`,
  ).run(id, `p${id}`, `p${id}`, 'x');
}

describe('sessions', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = open(':memory:');
    seedPlayer(db, 1);
  });

  it('creates and resolves a session', () => {
    createSession(db, 'hashA', 1, 1000);
    expect(lookupSession(db, 'hashA', 1000)).toBe(1);
  });

  it('returns null for an unknown token', () => {
    expect(lookupSession(db, 'nope', 1000)).toBeNull();
  });

  it('expires after 30 idle days', () => {
    createSession(db, 'hashA', 1, 0);
    // No use in between (any lookup would slide the expiry). 30 days on → gone.
    expect(lookupSession(db, 'hashA', SESSION_TTL_MS + 1)).toBeNull();
  });

  it('slides the expiry forward on use', () => {
    createSession(db, 'hashA', 1, 0);
    // Use it 29 days in; that slides expiry to 29d + 30d.
    expect(lookupSession(db, 'hashA', 29 * DAY)).toBe(1);
    // Original 30-day mark would have expired, but the slide keeps it alive.
    expect(lookupSession(db, 'hashA', SESSION_TTL_MS + DAY)).toBe(1);
  });

  it('rewrites the expiry at most once a day', () => {
    createSession(db, 'hashA', 1, 0);
    const expiry = () =>
      (
        db.prepare(`SELECT expires_at FROM sessions WHERE token_hash = 'hashA'`).get() as {
          expires_at: number;
        }
      ).expires_at;
    const before = expiry();
    lookupSession(db, 'hashA', 1000); // < 1 day since last slide → no write
    expect(expiry()).toBe(before);
    lookupSession(db, 'hashA', DAY + 1); // ≥ 1 day → slides
    expect(expiry()).toBe(DAY + 1 + SESSION_TTL_MS);
  });

  it('deletes only the named session', () => {
    createSession(db, 'hashA', 1, 0);
    createSession(db, 'hashB', 1, 0);
    deleteSession(db, 'hashA');
    expect(lookupSession(db, 'hashA', 1000)).toBeNull();
    expect(lookupSession(db, 'hashB', 1000)).toBe(1);
  });

  it('sweeps expired sessions', () => {
    createSession(db, 'live', 1, 0);
    createSession(db, 'dead', 1, -SESSION_TTL_MS - 1);
    expect(sweepExpiredSessions(db, 0)).toBe(1);
    expect(lookupSession(db, 'live', 1000)).toBe(1);
  });
});
