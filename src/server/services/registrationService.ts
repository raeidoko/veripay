import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { users } from '../db/store.ts';
import type { UserProfile } from '../../shared/types.ts';
import { registerState } from '../db/persistence.ts';
import { riskService } from './riskService.ts';
import { auditLogService } from './auditLogService.ts';

const directory = process.env.VERIPAY_ADMIN_DATA_DIR || path.join(process.cwd(), 'data', 'governance');
const filename = path.join(directory, 'accounts.json');
interface Account { user: UserProfile; salt: string; hash: string }
const accounts: Account[] = existsSync(filename) ? JSON.parse(readFileSync(filename, 'utf8')) : [];
registerState('accounts', accounts);
for (const account of accounts) if (!users.some(user => user.id === account.user.id)) users.push(account.user);

export const registrationService = {
  credential(userId: string) {
    const account = accounts.find(item => item.user.id === userId);
    return account ? { salt: Buffer.from(account.salt, 'hex'), hash: Buffer.from(account.hash, 'hex') } : null;
  },
  register(input: unknown): UserProfile {
    const body = (input || {}) as Record<string, unknown>;
    if (body.role !== 'buyer' && body.role !== 'seller') throw new Error('Choose Buyer or Seller');
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.replace(/[\s()-]/g, '') : '';
    if (name.length < 2 || name.length > 100) throw new Error('Enter a name between 2 and 100 characters');
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address');
    if (!/^(?:\+?234|0)[789][01]\d{8}$/.test(phone)) throw new Error('Enter a valid Nigerian phone number');
    if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128) throw new Error('Use a password between 10 and 128 characters');
    if (users.some(user => user.email.toLowerCase() === email)) throw new Error('An account already uses this email. Please sign in.');
    const user: UserProfile = { id: 'user_' + randomUUID(), name, email, phone: phone.startsWith('0') ? '+234' + phone.slice(1) : '+' + phone.replace(/^\+/, ''), role: body.role,
      accountStatus: 'PENDING', identityVerified: false, identityMethods: [] };
    const salt = randomBytes(16);
    const account: Account = {user, salt:salt.toString('hex'), hash:scryptSync(body.password,salt,64).toString('hex')};
    accounts.push(account);
    users.push(user);
    auditLogService.log({actorId:user.id,actorName:user.name,actorRole:user.role,action:'ACCOUNT_REGISTERED',entityType:'USER',entityId:user.id,changesSummary:'Account registered; awaiting identity document review and administrator approval.'});
    riskService.registerAttribute(user.id, 'PHONE', user.phone);
    if (typeof body.deviceId === 'string' && body.deviceId.trim() && body.deviceId.length <= 200) riskService.registerAttribute(user.id, 'DEVICE', body.deviceId);
    return user;
  },
};
