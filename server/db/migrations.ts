import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { tx } from './tx.ts';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

interface Migration {
  version: number;
  name: string;
  sql: string;
}

/** Load the forward-only .sql migrations, ordered by their numeric prefix. */
export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const migrations = files.map((name) => {
    const match = /^(\d+)/.exec(name);
    if (!match) {
      throw new Error(`Migration "${name}" must start with a numeric version prefix.`);
    }
    return {
      version: Number(match[1]),
      name,
      sql: readFileSync(join(dir, name), 'utf8'),
    };
  });

  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(`Migration "${m.name}" is out of order; expected version ${i + 1}.`);
    }
  });

  return migrations;
}

function currentVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  return row.user_version;
}

/**
 * Apply every migration newer than the database's `user_version`, each in its own
 * transaction, then bump `user_version`. Idempotent: re-running applies nothing.
 * Returns the number of migrations applied by this call.
 */
export function migrate(db: DatabaseSync, migrations: Migration[] = loadMigrations()): number {
  let version = currentVersion(db);
  let applied = 0;

  for (const migration of migrations) {
    if (migration.version <= version) continue;

    tx(db, () => {
      db.exec(migration.sql);
      // user_version does not accept bound parameters; the value is a validated integer.
      db.exec(`PRAGMA user_version = ${migration.version}`);
    });
    version = migration.version;
    applied += 1;
  }

  return applied;
}
