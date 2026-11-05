import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { localDatabasePath } from '../config.ts';
import { createPostgresRepository } from './postgresRepository.ts';

// A document repository preserves the existing typed domain model. All domain
// documents, credentials, wallet movements, and audit seals commit together.
export const databasePath = localDatabasePath;
const postgres = process.env.DATABASE_URL && process.env.VERIPAY_STORAGE !== 'sqlite'
  ? await createPostgresRepository(process.env.DATABASE_URL, process.env.VERIPAY_DB_SCHEMA)
  : undefined;
const remoteRows = postgres ? await postgres.read() : new Map<string, string>();
if (!postgres) mkdirSync(path.dirname(databasePath), { recursive: true });
const db = postgres ? undefined : new DatabaseSync(databasePath);
db?.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
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
db?.exec(`CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger_seals BEGIN SELECT RAISE(ABORT, 'Ledger entries are immutable'); END;
  CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger_seals BEGIN SELECT RAISE(ABORT, 'Ledger entries are immutable'); END;`);
const bindings = new Map<string, any>();
const loadHooks: (() => void)[] = [];
export function afterPersistenceLoad(hook: () => void) { loadHooks.push(hook); hook(); }
const read = db?.prepare('SELECT payload FROM documents WHERE name=?');
const write = db?.prepare('INSERT INTO documents(name,payload) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload WHERE payload<>excluded.payload');
const saved = (name: string) => postgres ? remoteRows.get(name) : (read!.get(name) as { payload: string } | undefined)?.payload;

function restore(target: any, value: any) {
  if (Array.isArray(target)) target.splice(0, target.length, ...value);
  else { for (const key of Object.keys(target)) delete target[key]; Object.assign(target, value); }
}
export function registerState<T extends object>(name: string, target: T): T {
  if (bindings.has(name)) throw new Error(`Duplicate repository: ${name}`);
  const payload = saved(name);
  if (payload) restore(target, JSON.parse(payload));
  bindings.set(name, target);
  return target;
}
export function hasSavedState(name: string) { return Boolean(saved(name)); }
async function persist() {
  if (postgres) {
    const documents = new Map<string, string>();
    const seals = new Map<string, { id: string; payload: string }[]>();
    for (const [name, value] of bindings) {
      documents.set(name, JSON.stringify(value));
      const table = name === 'auditLogs' ? 'audit_seals' : name === 'purchaseSnapshots' ? 'purchase_seals' : name === 'finance' ? 'ledger_seals' : undefined;
      if (table) seals.set(table, (name === 'finance' ? value.ledger : value).map((record: any) => ({ id: record.id, payload: JSON.stringify(record) })));
    }
    await postgres.write(documents, seals);
    return;
  }
  for (const [name, value] of bindings) {
    // These independently sealed tables also reject edits made through SQL.
    const table = name === 'auditLogs' ? 'audit_seals' : name === 'purchaseSnapshots' ? 'purchase_seals' : name === 'finance' ? 'ledger_seals' : null;
    if (table) {
      const records = name === 'finance' ? value.ledger : value;
      const seal = db!.prepare(`INSERT INTO ${table}(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE payload<>excluded.payload`);
      const existing = db!.prepare(`SELECT id FROM ${table}`).all() as { id: string }[];
      const ids = new Set(records.map((item: any) => item.id));
      if (existing.some(item => !ids.has(item.id))) throw new Error('Immutable record was removed');
      for (const item of records) seal.run(item.id, JSON.stringify(item));
    }
    write!.run(name, JSON.stringify(value));
  }
}
async function begin() { if (postgres) await postgres.begin(); else db!.exec('BEGIN IMMEDIATE'); }
async function finish(commit: boolean) { if (postgres) await postgres.finish(commit); else db!.exec(commit ? 'COMMIT' : 'ROLLBACK'); }
export async function initializePersistence() {
  await begin();
  try { await reloadPersistence(); await persist(); await finish(true); } catch (error) { await finish(false); throw error; }
}
export async function reloadPersistence() {
  if (postgres) {
    const rows = await postgres.read();
    remoteRows.clear();
    for (const [name, value] of rows) remoteRows.set(name, value);
  }
  for (const [name, target] of bindings) {
    const payload = saved(name);
    if (payload) restore(target, JSON.parse(payload));
  }
  for (const hook of loadHooks) hook();
}

// Existing services share typed objects. Serialize requests (including reads)
// so no request observes uncommitted changes while an AI call is awaiting I/O.
let queue = Promise.resolve();
export const persistenceMiddleware: RequestHandler = (_req, res, next) => {
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>(resolve => { release = resolve; });
  void previous.then(async () => {
    if (res.destroyed) { release(); return; }
    try { await begin(); await reloadPersistence(); }
    catch (error) { try { await finish(false); } catch {} release(); next(error); return; }
    const before = new Map([...bindings].map(([key, target]) => [key, JSON.stringify(target)]));
    const end = res.end;
    let ended = false;
    res.end = function (...args: any[]) {
      if (ended) return res;
      ended = true;
      void (async () => { try {
        if (res.statusCode < 400 && !res.destroyed) { await persist(); await finish(true); }
        else { await finish(false); for (const [key, value] of before) restore(bindings.get(key), JSON.parse(value)); }
      } catch (error) {
        try { await finish(false); } catch {}
        for (const [key, value] of before) restore(bindings.get(key), JSON.parse(value));
        console.error('Database transaction failed:', error);
        if (!res.headersSent) {
          res.statusCode = 503;
          res.removeHeader('Content-Length'); res.removeHeader('Set-Cookie'); res.removeHeader('ETag');
          res.setHeader('Content-Type', 'application/json');
          args = [JSON.stringify({ error: 'Changes could not be saved. Please try again.' })];
        } else { res.destroy(); }
      } finally { release(); }
      end.apply(res, args as any);
      })().catch(error => { console.error('Could not finish database response:', error); res.destroy(); });
      return res;
    } as typeof res.end;
    res.once('close', () => {
      if (!ended && !res.locals.backendPending) res.end();
    });
    next();
  }).catch(error => { release(); next(error); });
};

export async function storageHealth() {
  if (postgres) await postgres.health(); else db!.prepare('SELECT 1').get();
  return { engine: postgres ? 'postgres' : 'sqlite', schemaVersion: 1 };
}

export const durableFiles = postgres;
