import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { users } from '../db/store.ts';
import { registrationService } from './registrationService.ts';
import { registerState } from '../db/persistence.ts';
import { auditLogService } from './auditLogService.ts';

const cookieName = 'veripay_session';
const lifetimeMs = 8 * 60 * 60 * 1000;
const defaultPassword = 'VeriPay123!';
const configuredPassword = process.env.VERIPAY_DEMO_PASSWORD;
const validHostedPassword = configuredPassword && configuredPassword.trim().length >= 10 && configuredPassword.length <= 128;
const password = process.env.NODE_ENV === 'production'
  ? validHostedPassword ? configuredPassword : undefined
  : configuredPassword || defaultPassword;
const credentials = new Map(password ? users.map(user => {
  const salt = randomBytes(16);
  return [user.id, { salt, hash: scryptSync(password, salt, 64) }];
}) : []);
const dummy = { salt: randomBytes(16), hash: randomBytes(64) };
const sessions = new Map<string, { userId: string; expiresAt: number }>();
const attempts = new Map<string, { count: number; until: number }>();
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const sessionToken = (req: Request) => req.get('Cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
function issueSession(req: Request, res: Response, userId: string) {
  const previous = sessionToken(req);
  if (previous) sessions.delete(digest(previous));
  for (const [key, session] of sessions) if (session.expiresAt <= Date.now()) sessions.delete(key);
  const token = randomBytes(32).toString('hex');
  sessions.set(digest(token), {userId,expiresAt:Date.now()+lifetimeMs});
  res.cookie(cookieName,token,{httpOnly:true,sameSite:'lax',secure:req.secure,path:'/',maxAge:lifetimeMs});
}
const registrations = new Map<string,{count:number;until:number}>();
const resetAttempts = new Map<string, { count: number; until: number }>();
const resetCodes = registerState('passwordResetCodes', {} as Record<string, { hash: string; expiresAt: number }>);
const resetLifetimeMs = 15 * 60 * 1000;

export const authService = {
  issuePasswordReset(req: Request, res: Response) {
    const admin = res.locals.user;
    if (admin?.role !== 'admin') return res.status(403).json({ error: 'Administrator access required' });
    const user = users.find(item => item.id === req.params.id);
    if (!user || user.role === 'admin' || !registrationService.credential(user.id)) {
      return res.status(404).json({ error: 'Password recovery is available for registered buyer and seller accounts' });
    }
    if (req.body?.identityVerified !== true) return res.status(400).json({ error: 'Verify the account owner before issuing a code' });
    const now = Date.now();
    for (const [id, code] of Object.entries(resetCodes)) if (code.expiresAt <= now) delete resetCodes[id];
    if ((resetCodes[user.id]?.expiresAt ?? 0) > now + resetLifetimeMs - 60_000) {
      res.set('Retry-After', '60');
      return res.status(429).json({ error: 'Wait one minute before issuing another code for this account' });
    }
    const code = randomBytes(16).toString('hex');
    resetCodes[user.id] = { hash: digest(code), expiresAt: now + resetLifetimeMs };
    auditLogService.log({ actorId: admin.id, actorName: admin.name, actorRole: 'admin', action: 'PASSWORD_RESET_ISSUED', entityType: 'USER', entityId: user.id, changesSummary: 'Administrator confirmed identity verification and issued a single-use recovery code.' });
    return res.json({ code, expiresInMinutes: 15 });
  },

  resetPassword(req: Request, res: Response) {
    const now = Date.now();
    for (const [ip, attempt] of resetAttempts) if (attempt.until <= now) resetAttempts.delete(ip);
    const ip = req.ip || 'local';
    const attempt = resetAttempts.get(ip);
    if (attempt && attempt.count >= 15) {
      res.set('Retry-After', String(Math.ceil((attempt.until - now) / 1000)));
      return res.status(429).json({ error: 'Too many password reset attempts. Try again later.' });
    }
    resetAttempts.set(ip, { count: (attempt?.count || 0) + 1, until: attempt?.until || now + resetLifetimeMs });
    const { code, password } = req.body || {};
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
      return res.status(400).json({ error: 'Use a password between 10 and 128 characters' });
    }
    const hash = typeof code === 'string' && /^[a-f0-9]{32}$/.test(code) ? digest(code) : '';
    const match = Object.entries(resetCodes).find(([, entry]) => entry.expiresAt > now && entry.hash === hash);
    if (!match || !registrationService.replacePassword(match[0], password)) {
      return res.status(400).json({ error: 'This recovery code is invalid or expired' });
    }
    const [userId] = match;
    delete resetCodes[userId];
    auditLogService.log({ actorId: userId, actorName: 'Account holder', actorRole: 'SYSTEM', action: 'PASSWORD_RESET_COMPLETED', entityType: 'USER', entityId: userId, changesSummary: 'Password changed through a single-use recovery code.' });
    res.once('finish', () => {
      if (res.statusCode !== 200) return;
      for (const [key, session] of sessions) if (session.userId === userId) sessions.delete(key);
      const email = users.find(user => user.id === userId)?.email.toLowerCase();
      if (email) for (const key of attempts.keys()) if (key.endsWith(`:${email}`)) attempts.delete(key);
    });
    return res.json({ success: true });
  },

  register(req: Request, res: Response) {
    const now = Date.now();
    for (const [key,value] of registrations) if(value.until<=now) registrations.delete(key);
    const key = req.ip || 'local';
    const attempt = registrations.get(key);
    if (attempt && attempt.count >= 10) {
      res.set('Retry-After',String(Math.ceil((attempt.until-now)/1000)));
      return res.status(429).json({error:'Too many registration attempts. Try again later.'});
    }
    registrations.set(key,{count:(attempt?.count||0)+1,until:attempt?.until||now+60*60*1000});
    try {
      const user = registrationService.register(req.body);
      issueSession(req,res,user.id);
      return res.status(201).json({user});
    } catch(error:unknown) {
      return res.status(400).json({error:error instanceof Error ? error.message : 'Could not create account'});
    }
  },
  demoAccounts() {
    return {
      accounts: users.filter(user => ['user_buyer_1', 'user_seller_1', 'user_admin_1'].includes(user.id))
        .map(({ email, name, role }) => ({ email, name, role })),
      // Only expose the intentionally public default demo password, never an override.
      demoPassword: password === defaultPassword && !configuredPassword ? defaultPassword : null,
      enabled: Boolean(password),
    };
  },

  currentUser(req: Request) {
    const token = sessionToken(req);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const key = digest(token);
    const session = sessions.get(key);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) { sessions.delete(key); return null; }
    const user = users.find(user => user.id === session.userId);
    if (!user || ['SUSPENDED','REJECTED'].includes(user.accountStatus || '')) { sessions.delete(key); return null; }
    return user;
  },

  login(req: Request, res: Response) {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const suppliedPassword = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || email.length > 254 || !suppliedPassword || suppliedPassword.length > 256) {
      return res.status(400).json({ error: 'Enter your email address and password' });
    }
    const now = Date.now();
    for (const [key, attempt] of attempts) if (attempt.until <= now) attempts.delete(key);
    const key = `${req.ip}:${email}`;
    const attempt = attempts.get(key);
    if (attempt && attempt.count >= 5) {
      res.setHeader('Retry-After', Math.ceil((attempt.until - now) / 1000));
      return res.status(429).json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' });
    }
    const user = users.find(item => item.email.toLowerCase() === email);
    const stored = user ? registrationService.credential(user.id) || credentials.get(user.id) || dummy : dummy;
    const hash = scryptSync(suppliedPassword, stored.salt, 64);
    if (!timingSafeEqual(hash, stored.hash) || !user) {
      attempts.set(key, { count: (attempt?.count || 0) + 1, until: attempt?.until || now + 15 * 60 * 1000 });
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }
    attempts.delete(key);
    if (['SUSPENDED','REJECTED'].includes(user.accountStatus || '')) return res.status(403).json({error:'This account is ' + user.accountStatus!.toLowerCase() + '. Contact the administrator.'});
    issueSession(req,res,user.id);
    return res.json({ user });
  },

  logout(req: Request, res: Response) {
    const token = sessionToken(req);
    if (token) sessions.delete(digest(token));
    res.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/' });
  },
};
