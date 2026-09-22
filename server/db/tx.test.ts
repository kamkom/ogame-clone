import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { tx } from './tx.ts';

describe('tx', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
  });

  afterEach(() => {
    db.close();
  });

  const rows = () => db.prepare('SELECT v FROM t ORDER BY id').all() as { v: string }[];

  it('commits on success and returns the callback result', () => {
    const result = tx(db, (d) => {
      d.exec("INSERT INTO t (v) VALUES ('a')");
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(rows()).toEqual([{ v: 'a' }]);
  });

  it('rolls back on a throw and re-throws', () => {
    expect(() =>
      tx(db, (d) => {
        d.exec("INSERT INTO t (v) VALUES ('b')");
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(rows()).toEqual([]);
    expect(db.isTransaction).toBe(false);
  });

  it('rejects an async callback and rolls back', () => {
    expect(() =>
      tx(db, (d) => {
        d.exec("INSERT INTO t (v) VALUES ('c')");
        return Promise.resolve('nope');
      }),
    ).toThrow(/synchronous/);
    expect(rows()).toEqual([]);
    expect(db.isTransaction).toBe(false);
  });
});
