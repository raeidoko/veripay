import pg, { type PoolClient } from 'pg';

export async function createPostgresRepository(connectionString: string, schema = 'public') {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Invalid database schema');
  const pool = new pg.Pool({ connectionString, max: 2, connectionTimeoutMillis: 10_000 });
  pool.on('error', () => { console.error('Database connection interrupted'); });
  const namespace = `"${schema}"`;
  const setup = await pool.connect();
  let setupReleased = false;
  try {
    await setup.query('BEGIN');
    await setup.query('SELECT pg_advisory_xact_lock(20261105, 1)');
    await setup.query(`CREATE SCHEMA IF NOT EXISTS ${namespace}`);
    await setup.query(`CREATE TABLE IF NOT EXISTS ${namespace}.schema_migrations(version INTEGER PRIMARY KEY)`);
    await setup.query(`INSERT INTO ${namespace}.schema_migrations VALUES(1) ON CONFLICT DO NOTHING`);
    await setup.query(`CREATE TABLE IF NOT EXISTS ${namespace}.documents(name TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(payload::json IS NOT NULL))`);
    for (const table of ['audit_seals', 'purchase_seals', 'ledger_seals']) {
      await setup.query(`CREATE TABLE IF NOT EXISTS ${namespace}.${table}(id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(payload::json IS NOT NULL))`);
    }
    await setup.query(`CREATE TABLE IF NOT EXISTS ${namespace}.file_blobs(name TEXT PRIMARY KEY, content BYTEA NOT NULL)`);
    await setup.query(`CREATE OR REPLACE FUNCTION ${namespace}.veripay_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Sealed records are immutable'; END $$`);
    for (const table of ['audit_seals', 'purchase_seals', 'ledger_seals']) {
      await setup.query(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='${namespace}.${table}'::regclass AND tgname='veripay_immutable') THEN CREATE TRIGGER veripay_immutable BEFORE UPDATE OR DELETE ON ${namespace}.${table} FOR EACH ROW EXECUTE FUNCTION ${namespace}.veripay_immutable(); END IF; END $$`);
    }
    for (const table of ['schema_migrations', 'documents', 'audit_seals', 'purchase_seals', 'ledger_seals', 'file_blobs']) {
      await setup.query(`ALTER TABLE ${namespace}.${table} ENABLE ROW LEVEL SECURITY`);
      await setup.query(`REVOKE ALL ON TABLE ${namespace}.${table} FROM PUBLIC`);
    }
    await setup.query('COMMIT');
  } catch (error) {
    await setup.query('ROLLBACK').catch(() => {});
    setup.release(true);
    setupReleased = true;
    await pool.end();
    throw error;
  } finally {
    if (!setupReleased) setup.release();
  }

  let transaction: PoolClient | undefined;
  const query = (sql: string, values?: unknown[]) => (transaction || pool).query(sql, values);
  return {
    async read() {
      const { rows } = await query(`SELECT name,payload FROM ${namespace}.documents`);
      return new Map<string, string>(rows.map(row => [row.name, row.payload]));
    },
    async begin() {
      if (transaction) throw new Error('A database transaction is already active');
      transaction = await pool.connect();
      try {
        await transaction.query('BEGIN');
        await transaction.query('SELECT pg_advisory_xact_lock(20261105, 1)');
      } catch (error) {
        const client = transaction;
        transaction = undefined;
        client.release(true);
        throw error;
      }
    },
    async finish(commit: boolean) {
      const client = transaction;
      if (!client) return;
      transaction = undefined;
      try {
        await client.query(commit ? 'COMMIT' : 'ROLLBACK');
        client.release();
      } catch (error) {
        client.release(true);
        throw error;
      }
    },
    async write(documents: Map<string, string>, seals: Map<string, { id: string; payload: string }[]>) {
      for (const [table, records] of seals) {
        const existing = await query(`SELECT id FROM ${namespace}.${table}`);
        const ids = new Set(records.map(record => record.id));
        if (existing.rows.some(row => !ids.has(row.id))) throw new Error('Immutable record was removed');
        if (records.length) await query(`INSERT INTO ${namespace}.${table}(id,payload) SELECT id,payload FROM jsonb_to_recordset($1::jsonb) AS x(id TEXT,payload TEXT) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload WHERE ${table}.payload<>EXCLUDED.payload`, [JSON.stringify(records)]);
      }
      await query(`INSERT INTO ${namespace}.documents(name,payload) SELECT name,payload FROM jsonb_to_recordset($1::jsonb) AS x(name TEXT,payload TEXT) ON CONFLICT(name) DO UPDATE SET payload=EXCLUDED.payload WHERE documents.payload<>EXCLUDED.payload`, [JSON.stringify([...documents].map(([name, payload]) => ({ name, payload })))]);
    },
    async saveFile(name: string, content: Buffer) {
      await query(`INSERT INTO ${namespace}.file_blobs(name,content) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET content=EXCLUDED.content`, [name, content]);
    },
    async readFile(name: string): Promise<Buffer | undefined> {
      return (await query(`SELECT content FROM ${namespace}.file_blobs WHERE name=$1`, [name])).rows[0]?.content;
    },
    async health() { await pool.query('SELECT 1'); },
  };
}
