import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { requestOriginGuard } from '../src/server/requestOrigin.ts';

function check(headers: Record<string, string | undefined>, publicOrigin?: string, protocol = 'http', method = 'POST') {
  let status = 200;
  let passed = false;
  const req = { method, protocol, get: (name: string) => headers[name] } as Request;
  const res = { status(code: number) { status = code; return this; }, json() {} } as unknown as Response;
  requestOriginGuard(publicOrigin)(req, res, () => { passed = true; });
  return { status, passed };
}

test('accepts local and TLS-terminated same-origin registration requests', () => {
  for (const Origin of ['http://localhost:3001', 'https://localhost:3001']) {
    assert.equal(check({ Host: 'localhost:3001', Origin, 'Sec-Fetch-Site': 'same-origin' }).passed, true);
  }
  assert.equal(check({ Host: 'internal:3001', Origin: 'https://veripay.example' }, 'https://veripay.example/').passed, true);
});

test('accepts the hosted Render demo login after HTTPS terminates at the proxy', () => {
  assert.deepEqual(check({
    Host: 'veripay-api-ib67.onrender.com',
    Origin: 'https://veripay-api-ib67.onrender.com',
    'Sec-Fetch-Site': 'same-origin',
  }), { status: 200, passed: true });
  assert.deepEqual(check({
    Host: 'veripay-api-ib67.onrender.com',
    Origin: 'https://untrusted.example',
    'Sec-Fetch-Site': 'cross-site',
  }), { status: 403, passed: false });
});

test('rejects foreign origins, changed ports, forged forwarding headers and cross-site requests', () => {
  for (const headers of [
    { Origin: 'https://evil.example' },
    { Origin: 'http://localhost:3002' },
    { Origin: 'null' },
    { Origin: 'https://evil.example', 'X-Forwarded-Host': 'evil.example' },
    { Origin: 'http://localhost:3001', 'Sec-Fetch-Site': 'cross-site' },
  ]) {
    assert.deepEqual(check({ Host: 'localhost:3001', ...headers }), { status: 403, passed: false });
  }
  assert.equal(check({ Host: 'veripay.example', Origin: 'http://veripay.example' }, undefined, 'https').status, 403);
});

test('preserves requests without Origin and safe methods; rejects malformed public configuration', () => {
  assert.equal(check({ Host: 'localhost:3001' }).passed, true);
  assert.equal(check({ Origin: 'https://evil.example' }, undefined, 'http', 'GET').passed, true);
  for (const origin of ['null', 'ftp://example.com', 'https://example.com/path', 'https://user:password@example.com']) {
    assert.throws(() => requestOriginGuard(origin));
  }
});
