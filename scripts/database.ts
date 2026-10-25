import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { localDatabasePath } from '../src/server/config.ts';

const action = process.argv[2];
if (!['check','backup'].includes(action)) throw new Error('Use database.ts check or database.ts backup [destination]');
if (!existsSync(localDatabasePath)) throw new Error('Database does not exist. Start the app once before running maintenance.');
const db = new DatabaseSync(localDatabasePath, { readOnly: action === 'check' });
try {
  db.exec('BEGIN');
  assert.equal((db.prepare('PRAGMA integrity_check').get() as any).integrity_check,'ok');
  const document = (name: string) => {
    const row = db.prepare('SELECT payload FROM documents WHERE name=?').get(name) as {payload:string} | undefined;
    if (!row) throw new Error(`Missing database document: ${name}`);
    return JSON.parse(row.payload);
  };
  for (const snapshot of document('purchaseSnapshots')) {
    assert.equal(snapshot.sha256,createHash('sha256').update(JSON.stringify(snapshot.payload)).digest('hex'),`Snapshot mismatch: ${snapshot.id}`);
  }
  const finance = document('finance');
  const balances = new Map<string,number>();
  for(const movement of finance.ledger) {
    assert.ok(Number.isSafeInteger(movement.amountKobo) && movement.amountKobo > 0,'Invalid ledger amount');
    if(movement.from !== 'sandbox') balances.set(movement.from,(balances.get(movement.from)||0)-movement.amountKobo);
    balances.set(movement.to,(balances.get(movement.to)||0)+movement.amountKobo);
  }
  for(const account of new Set([...balances.keys(),...Object.keys(finance.balances),...Object.keys(finance.holds).map(id=>'escrow:'+id)])) {
    const recorded = account.startsWith('escrow:') ? finance.holds[account.slice(7)]?.amountKobo || 0 : finance.balances[account] || 0;
    assert.ok(Number.isSafeInteger(recorded) && recorded >= 0,`Invalid balance: ${account}`);
    assert.equal(recorded,balances.get(account)||0,`Ledger reconciliation failed: ${account}`);
  }
  for(const [name,table] of [['auditLogs','audit_seals'],['purchaseSnapshots','purchase_seals'],['finance','ledger_seals']]) {
    const records = name==='finance' ? finance.ledger : document(name);
    const sealed = new Map((db.prepare(`SELECT id,payload FROM ${table}`).all() as {id:string;payload:string}[]).map(item=>[item.id,item.payload]));
    assert.equal(sealed.size,records.length,`Seal count mismatch: ${name}`);
    for(const item of records) assert.equal(sealed.get(item.id),JSON.stringify(item),`Seal mismatch: ${item.id}`);
  }
  db.exec('COMMIT');
  if(action==='backup') {
    const destination = path.resolve(process.argv[3] || path.join('backups',`veripay-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`));
    if(existsSync(destination)) throw new Error('Backup destination already exists; choose a new filename.');
    mkdirSync(path.dirname(destination),{recursive:true});
    // VACUUM INTO produces a consistent standalone snapshot, including WAL data.
    db.prepare('VACUUM INTO ?').run(destination);
    console.log(`Database backup saved: ${destination}`);
  } else console.log('Database integrity, snapshot seals, audit seals and wallet ledger reconciliation passed.');
} finally { db.close(); }
