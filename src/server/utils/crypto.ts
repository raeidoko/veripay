import crypto from 'node:crypto';

export function calculateSha256(data: string | object): string {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function hashSaltedAttribute(value: string, salt: string = 'veripay-salt-2026'): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return crypto.createHash('sha256').update(`${salt}:${normalized}`).digest('hex');
}
