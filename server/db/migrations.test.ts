import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { loadMigrations, migrate } from './migrations.ts';

describe('migrate', () => {
  it('applies every migration on a fresh database and reports the count', () => {
    const db = new DatabaseSync(':memory:');
    const migrations = loadMigrations();
    const applied = migrate(db, migrations);
    expect(applied).toBe(migrations.length);

    const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(user_version).toBe(migrations.at(-1)!.version);
    db.close();
  });

  it('is idempotent: a second run applies nothing', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    expect(migrate(db)).toBe(0);
    db.close();
  });

  it('loads migrations with strictly increasing versions starting at 1', () => {
    const migrations = loadMigrations();
    expect(migrations[0]!.version).toBe(1);
    migrations.forEach((m, i) => expect(m.version).toBe(i + 1));
  });
});
