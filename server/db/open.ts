import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from './migrations.ts';

export interface OpenOptions {
  /** Skip migrations (used only by low-level tests). Defaults to false. */
  migrations?: boolean;
}

/**
 * Open (or create) the database at `path`:
 *  - create the parent data directory,
 *  - enable WAL, foreign keys, a busy timeout and NORMAL synchronous,
 *  - apply pending migrations.
 *
 * `:memory:` databases skip the directory step. Returns the live DatabaseSync.
 */
export function open(path: string, options: OpenOptions = {}): DatabaseSync {
  if (path !== ':memory:' && !path.startsWith('file::memory:')) {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA synchronous = NORMAL');

  if (options.migrations !== false) {
    migrate(db);
  }

  return db;
}
