import type { DatabaseSync } from 'node:sqlite';

/**
 * Run `fn` inside a `BEGIN IMMEDIATE` transaction: commit on success, roll back on a
 * throw and re-throw. The callback must be synchronous — an async callback would commit
 * before its work finished, so it is refused up front.
 */
export function tx<T>(db: DatabaseSync, fn: (db: DatabaseSync) => T): T {
  db.exec('BEGIN IMMEDIATE');
  let result: T;
  try {
    result = fn(db);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  if (result instanceof Promise) {
    db.exec('ROLLBACK');
    throw new TypeError('tx() callback must be synchronous; it returned a Promise.');
  }

  db.exec('COMMIT');
  return result;
}
