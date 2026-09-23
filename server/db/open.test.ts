import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMigrations } from './migrations.ts';
import { open } from './open.ts';

describe('open (real temporary file)', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ogame-open-'));
    // Nested path so we prove the data directory is created.
    dbPath = join(dir, 'data', 'ogame.sqlite');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const latestVersion = () => loadMigrations().at(-1)!.version;

  it('creates the data directory and the database file', () => {
    expect(existsSync(join(dir, 'data'))).toBe(false);
    const db = open(dbPath);
    expect(existsSync(dbPath)).toBe(true);
    db.close();
  });

  it('enables WAL mode', () => {
    const db = open(dbPath);
    const { journal_mode } = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    expect(journal_mode.toLowerCase()).toBe('wal');
    db.close();
  });

  it('applies migrations up to the latest user_version', () => {
    const db = open(dbPath);
    const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(user_version).toBe(latestVersion());
    // A table from the migration exists.
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='players'")
      .get();
    expect(table).toBeTruthy();
    db.close();
  });

  it('re-opening the same file applies nothing twice', () => {
    const first = open(dbPath);
    first.close();

    const second = open(dbPath);
    const { user_version } = second.prepare('PRAGMA user_version').get() as {
      user_version: number;
    };
    expect(user_version).toBe(latestVersion());
    second.close();
  });

  it('turns foreign keys on', () => {
    const db = open(dbPath);
    const { foreign_keys } = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    expect(foreign_keys).toBe(1);
    db.close();
  });

  it('sweeps expired sessions when opened with a time', () => {
    const first = open(dbPath);
    first.exec(
      `INSERT INTO players (id, username, username_lower, password_hash, created_at)
       VALUES (1, 'Vega', 'vega', 'x', 0)`,
    );
    const insert = first.prepare(
      'INSERT INTO sessions (token_hash, player_id, created_at, expires_at) VALUES (?, 1, 0, ?)',
    );
    insert.run('dead', 1_000);
    insert.run('live', 5_000);
    first.close();

    const second = open(dbPath, { now: 2_000 });
    const rows = second.prepare('SELECT token_hash FROM sessions').all();
    expect(rows).toEqual([{ token_hash: 'live' }]);
    second.close();
  });
});
