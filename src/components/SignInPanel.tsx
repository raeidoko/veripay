import React, { useEffect, useState } from 'react';
import { ArrowRight, Lock, ShieldCheck, ShoppingBag, Store, UserCheck } from 'lucide-react';
import type { UserProfile } from '../shared/types.ts';
import { api } from '../client/api.ts';
import { BrandLogo } from './BrandLogo.tsx';

export function SignInPanel({ onSignedIn, message }: { onSignedIn: (user: UserProfile) => void; message?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registering,setRegistering] = useState(false);
  const [role,setRole] = useState<'buyer'|'seller'|''>('');
  const [name,setName] = useState('');
  const [phone,setPhone] = useState('');
  const [confirmPassword,setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState<Awaited<ReturnType<typeof api.getDemoAccounts>> | null>(null);
  useEffect(() => { api.getDemoAccounts().then(setDemo).catch(() => {}); }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if(registering && !role) {setError('Choose whether to register as a buyer or seller');return;}
    if(registering && password!==confirmPassword) {setError('Passwords do not match');return;}
    setBusy(true);
    setError('');
    try { onSignedIn(registering && role ? await api.registerAccount({name,email,phone,password,role}) : await api.signIn(email, password)); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not sign in'); }
    finally { setBusy(false); }
  }

  function changeMode(value:boolean) {
    setRegistering(value);setRole('');setError('');setPassword('');setConfirmPassword('');
  }

  return <main className="min-h-screen brand-auth bg-slate-50 px-5 py-6 sm:py-10 flex items-center justify-center">
    <div className="w-full max-w-4xl grid gap-6 md:gap-10 md:grid-cols-2 md:items-center">
      <section className="space-y-4 md:space-y-6 text-center md:text-left">
        <BrandLogo size="signin" />
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600"><ShieldCheck className="h-4 w-4" /> Protected commerce, connected accounts</div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">Your account.<br />Your own workspace.</h1>
        <p className="mx-auto md:mx-0 max-w-sm text-sm leading-relaxed text-slate-500">Sign in to shop with escrow protection, manage your storefront, or keep transactions running smoothly.</p>
        <div className="hidden md:grid gap-4 text-sm text-slate-600">
          <p className="flex gap-3 items-center"><ShoppingBag className="h-5 w-5 text-brand-500" /> Track purchases and share product reviews</p>
          <p className="flex gap-3 items-center"><Store className="h-5 w-5 text-brand-500" /> Manage products, images, and deliveries</p>
          <p className="flex gap-3 items-center"><UserCheck className="h-5 w-5 text-brand-500" /> Review disputes and protect transactions</p>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <div className="mb-4 inline-flex rounded-xl bg-brand-50 p-3 text-brand-600"><Lock className="h-5 w-5" /></div>
          <h2 className="text-xl font-bold text-slate-900">{registering ? 'Create your account' : 'Welcome back'}</h2>
          <p className="mt-1 text-sm text-slate-500">{registering ? 'Create your account, then submit documents for admin approval.' : 'Sign in to your VeriPay account.'}</p>
        </div>
        {message && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{message}</p>}
        <form onSubmit={submit} className="space-y-4">
          {registering && <>
            <div>
              <label htmlFor="signup-role" className="mb-1.5 block text-xs font-semibold text-slate-700">Register as</label>
              <select id="signup-role" value={role} onChange={e=>setRole(e.target.value as 'buyer'|'seller'|'')} required disabled={busy} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="" disabled>Choose Buyer or Seller</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </select>
            </div>
            <div>
              <label htmlFor="signup-name" className="mb-1.5 block text-xs font-semibold text-slate-700">{role==='seller'?'Store / business name':'Full name'}</label>
              <input id="signup-name" value={name} onChange={e=>setName(e.target.value)} autoComplete={role==='seller'?'organization':'name'} required minLength={2} maxLength={100} disabled={busy} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"/>
            </div>
            <div>
              <label htmlFor="signup-phone" className="mb-1.5 block text-xs font-semibold text-slate-700">Phone number</label>
              <input id="signup-phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel" required maxLength={30} placeholder="0803 123 4567" disabled={busy} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"/>
            </div>
          </>}
          <div>
            <label htmlFor="signin-email" className="mb-1.5 block text-xs font-semibold text-slate-700">Email address</label>
            <input id="signin-email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required maxLength={254} disabled={busy}
              placeholder="you@example.com" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label htmlFor="signin-password" className="mb-1.5 block text-xs font-semibold text-slate-700">Password</label>
            <input id="signin-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={registering?'new-password':'current-password'} required minLength={registering?10:undefined} maxLength={registering?128:256} disabled={busy}
              placeholder="Enter your password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            {registering&&<p className="mt-1 text-[11px] text-slate-500">Use at least 10 characters.</p>}
          </div>
          {registering&&<div>
            <label htmlFor="signup-confirm" className="mb-1.5 block text-xs font-semibold text-slate-700">Confirm password</label>
            <input id="signup-confirm" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={10} maxLength={128} disabled={busy} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"/>
          </div>}
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
          <button type="submit" disabled={busy} className="w-full flex justify-center items-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? registering?'Creating account…':'Signing in…' : registering?'Create account':'Sign in'} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        {registering ? <button type="button" disabled={busy} onClick={()=>changeMode(false)} className="mt-4 w-full text-xs font-semibold text-brand-600 hover:underline">Already have an account? Sign in</button> : <button type="button" disabled={busy} onClick={()=>changeMode(true)} className="mt-4 w-full rounded-lg border border-brand-600 px-4 py-3 text-sm font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50">Register on VeriPay</button>}
        {!registering && demo && <details className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold text-slate-600">Local demo accounts</summary>
          <p className="mt-3 leading-relaxed">Choose an account to try its workspace.{demo.demoPassword && <> Demo password: <code className="text-slate-800">{demo.demoPassword}</code></>}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {demo.accounts.map(account => <button key={account.email} type="button" disabled={busy}
              onClick={() => { setEmail(account.email); setPassword(demo.demoPassword || ''); setError(''); }}
              className="rounded-lg border border-slate-200 px-2 py-2 font-semibold capitalize text-brand-600 hover:bg-brand-50">{account.role}</button>)}
          </div>
        </details>}
      </section>
    </div>
  </main>;
}
