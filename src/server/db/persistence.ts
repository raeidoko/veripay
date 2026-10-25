import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { localDatabasePath } from '../config.ts';

// A document repository preserves the existing typed domain model. All domain
// documents, credentials, wallet movements, and audit seals commit together.
export const databasePath = localDatabasePath;
mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY);
  INSERT OR IGNORE INTO schema_migrations VALUES(1);
  CREATE TABLE IF NOT EXISTS documents(name TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)));
  CREATE TABLE IF NOT EXISTS audit_seals(id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)));
  CREATE TABLE IF NOT EXISTS purchase_seals(id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)));
  CREATE TABLE IF NOT EXISTS ledger_seals(id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)));
  CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_seals BEGIN SELECT RAISE(ABORT, 'Audit records are immutable'); END;
  CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_seals BEGIN SELECT RAISE(ABORT, 'Audit records are immutable'); END;
  CREATE TRIGGER IF NOT EXISTS purchase_no_update BEFORE UPDATE ON purchase_seals BEGIN SELECT RAISE(ABORT, 'Purchase snapshots are immutable'); END;
  CREATE TRIGGER IF NOT EXISTS purchase_no_delete BEFORE DELETE ON purchase_seals BEGIN SELECT RAISE(ABORT, 'Purchase snapshots are immutable'); END;`);
db.exec(`CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger_seals BEGIN SELECT RAISE(ABORT, 'Ledger entries are immutable'); END;
  CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger_seals BEGIN SELECT RAISE(ABORT, 'Ledger entries are immutable'); END;`);
const bindings = new Map<string, any>();
const read = db.prepare('SELECT payload FROM documents WHERE name=?');
const write = db.prepare('INSERT INTO documents(name,payload) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload WHERE payload<>excluded.payload');

function restore(target: any, value: any) {
  if (Array.isArray(target)) target.splice(0, target.length, ...value);
  else { for (const key of Object.keys(target)) delete target[key]; Object.assign(target, value); }
}
export function registerState<T extends object>(name: string, target: T): T {
  if (bindings.has(name)) throw new Error(`Duplicate repository: ${name}`);
  const row = read.get(name) as { payload: string } | undefined;
  if (row) restore(target, JSON.parse(row.payload));
  bindings.set(name, target);
  return target;
}
export function hasSavedState(name: string) { return Boolean(read.get(name)); }
function persist() {
  for (const [name, value] of bindings) {
    // These independently sealed tables also reject edits made through SQL.
    const table = name === 'auditLogs' ? 'audit_seals' : name === 'purchaseSnapshots' ? 'purchase_seals' : name === 'finance' ? 'ledger_seals' : null;
    if (table) {
      const records = name === 'finance' ? value.ledger : value;
      const seal = db.prepare(`INSERT INTO ${table}(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE payload<>excluded.payload`);
      const existing = db.prepare(`SELECT id FROM ${table}`).all() as { id: string }[];
      const ids = new Set(records.map((item: any) => item.id));
      if (existing.some(item => !ids.has(item.id))) throw new Error('Immutable record was removed');
      for (const item of records) seal.run(item.id, JSON.stringify(item));
    }
    write.run(name, JSON.stringify(value));
  }
}
export function initializePersistence() {
  db.exec('BEGIN IMMEDIATE');
  try { persist(); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function reloadPersistence() {
  for (const [name, target] of bindings) {
    const row = read.get(name) as { payload: string } | undefined;
    if (row) restore(target, JSON.parse(row.payload));
  }
}

// Existing services share typed objects. Serialize requests (including reads)
// so no request observes uncommitted changes while an AI call is awaiting I/O.
let queue = Promise.resolve();
export const persistenceMiddleware: RequestHandler = (_req, res, next) => {
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>(resolve => { release = resolve; });
  void previous.then(() => {
    if (res.destroyed) { release(); return; }
    try { db.exec('BEGIN IMMEDIATE'); reloadPersistence(); }
    catch (error) { try { db.exec('ROLLBACK'); } catch {} release(); next(error); return; }
    const before = new Map([...bindings].map(([key, target]) => [key, JSON.stringify(target)]));
    const end = res.end;
    let ended = false;
    res.end = function (...args: any[]) {
      if (ended) return res;
      ended = true;
      try {
        if (res.statusCode < 400 && !res.destroyed) { persist(); db.exec('COMMIT'); }
        else { db.exec('ROLLBACK'); for (const [key, value] of before) restore(bindings.get(key), JSON.parse(value)); }
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        for (const [key, value] of before) restore(bindings.get(key), JSON.parse(value));
        console.error('Database transaction failed:', error);
        if (!res.headersSent) {
          res.statusCode = 503;
          res.removeHeader('Content-Length'); res.removeHeader('Set-Cookie'); res.removeHeader('ETag');
          res.setHeader('Content-Type', 'application/json');
          args = [JSON.stringify({ error: 'Changes could not be saved. Please try again.' })];
        } else { res.destroy(); }
      } finally { release(); }
      return end.apply(res, args as any);
    } as typeof res.end;
    res.once('close', () => {
      if (!ended && !res.locals.backendPending) res.end();
    });
    next();
  }).catch(error => { release(); next(error); });
};

export function storageHealth() {
  db.prepare('SELECT 1').get();
  return { engine: 'sqlite', schemaVersion: 1 };
}
