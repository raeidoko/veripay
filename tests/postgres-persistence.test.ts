import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

test('hosted accounts, recovery codes and private documents survive a fresh filesystem', { skip: !process.env.VERIPAY_TEST_DATABASE_URL }, async () => {
  const connectionString = process.env.VERIPAY_TEST_DATABASE_URL!;
  const schema = `test_veripay_${Date.now()}`;
  const password = 'PostgresRegression123!';
  const base = 'http://127.0.0.1:19386/api';
  await mkdir('tmp', { recursive: true });
  const directory = await mkdtemp(path.resolve('tmp/postgres-test-'));
  let server: ChildProcess | undefined;
  async function stop() {
    if (server && server.exitCode === null) await new Promise<void>(resolve => { server!.once('exit', resolve); server!.kill(); });
  }
  async function start(name: string) {
    server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production', PORT: '19386', AI_PROVIDER: 'rules', DATABASE_URL: connectionString, VERIPAY_STORAGE: 'postgres', VERIPAY_DB_SCHEMA: schema, VERIPAY_DEMO_PASSWORD: password, VERIPAY_ADMIN_DATA_DIR: path.join(directory, name), VERIPAY_UPLOAD_DIR: path.join(directory, name, 'images') },
    });
    await new Promise<void>((resolve, reject) => {
      let diagnostics = '';
      server!.stderr!.on('data', chunk => { diagnostics += chunk; });
      const timer = setTimeout(() => reject(new Error(`Postgres test server did not start: ${diagnostics}`)), 40_000);
      server!.stdout!.on('data', chunk => { if (String(chunk).includes('Server running on port')) { clearTimeout(timer); resolve(); } });
      server!.once('exit', code => { clearTimeout(timer); reject(new Error(`Postgres test server exited ${code}`)); });
      server!.once('error', reject);
    });
  }
  async function request(route: string, body?: unknown, cookie?: string, raw?: { headers: Record<string, string>; bytes: Uint8Array }) {
    const response = await fetch(base + route, {
      method: body !== undefined || raw ? 'POST' : 'GET',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...raw?.headers },
      body: raw ? new Uint8Array(raw.bytes) : body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    });
    return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  try {
    await start('first');
    const login = async (email: string, supplied = password) => {
      const result = await request('/auth/login', { email, password: supplied });
      assert.equal(result.response.status, 200);
      return result.cookie!;
    };
    let admin = await login('tunde.risk@veripay.ng');
    const buyerInput = { name: 'Persistent Buyer', email: 'persistent-buyer@example.com', phone: '08031234567', password, role: 'buyer' };
    const registered = await request('/auth/register', buyerInput);
    assert.equal(registered.response.status, 201);
    const { user } = await registered.response.json();
    assert.equal(user.accountStatus, 'APPROVED');
    assert.equal(user.identityVerified, false);
    const seller = await request('/auth/register', { ...buyerInput, email: 'persistent-seller@example.com', role: 'seller' });
    const sellerUser = (await seller.response.json()).user;
    assert.equal(sellerUser.accountStatus, 'PENDING');
    const document = await request('/verification/documents', undefined, seller.cookie, { headers: { 'Content-Type': 'application/pdf', 'X-Document-Type': 'IDENTITY' }, bytes: new TextEncoder().encode('%PDF-1.4\nTest identity document') });
    assert.equal(document.response.status, 201);
    const doc = await document.response.json();
    const issued = await request(`/admin/users/${user.id}/password-reset`, { identityVerified: true }, admin);
    assert.equal(issued.response.status, 200);
    const { code } = await issued.response.json();
    await stop();
    // Different local directories simulate a Render instance replacement.
    await start('replacement');
    const buyer = await login(buyerInput.email);
    admin = await login('tunde.risk@veripay.ng');
    const health = await request('/health');
    assert.equal((await health.response.json()).storage.engine, 'postgres');
    const file = await request(`/verification/documents/${doc.id}/file`, undefined, admin);
    assert.equal(file.response.status, 200);
    assert.match(await file.response.text(), /Test identity document/);
    const changed = 'ChangedPersistent456!';
    const reset = await request('/auth/password-reset', { code, password: changed });
    assert.equal(reset.response.status, 200);
    assert.equal((await request('/auth/me', undefined, buyer)).response.status, 401);
    await stop();
    await start('second-replacement');
    await login(buyerInput.email, changed);
    const duplicate = await request('/auth/register', buyerInput);
    assert.equal(duplicate.response.status, 400);
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      await assert.rejects(client.query(`UPDATE "${schema}".audit_seals SET payload='{}'`), /immutable/);
    } finally { await client.end(); }
  } finally {
    await stop();
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      assert.match(schema, /^test_veripay_\d+$/);
      await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally { await client.end(); }
    assert.equal(path.dirname(directory), path.resolve('tmp'));
    await rm(directory, { recursive: true, force: true });
  }
});
