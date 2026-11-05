import React, { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, ShoppingBag, Store, UserCheck } from 'lucide-react';
import type { UserProfile } from '../shared/types.ts';
import { api } from '../client/api.ts';
import { BrandLogo } from './BrandLogo.tsx';

export function SignInPanel({ onSignedIn, message }: { onSignedIn: (user: UserProfile, registered?: boolean) => void; message?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recovering, setRecovering] = useState(window.location.pathname === '/forgot-password');
  const [notice, setNotice] = useState('');
  const [registering,setRegistering] = useState(window.location.pathname === '/register');
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
    try {
      const user = registering && role ? await api.registerAccount({name,email,phone,password,role}) : await api.signIn(email, password);
      window.history.replaceState(null, '', '/');
      onSignedIn(user, registering);
    }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not sign in'); }
    finally { setBusy(false); }
  }

  function changeMode(value:boolean) {
    window.history.replaceState(null, '', value ? '/register' : '/login');
    setRegistering(value);setRole('');setError('');setPassword('');setConfirmPassword('');
    setShowPassword(false);setNotice('');
  }

  if (recovering) return <ResetPasswordPanel onBack={changed => {
    window.history.replaceState(null, '', '/login');
    setRecovering(false);
    if (changed) setNotice('Password updated. Sign in with your new password.');
  }} />;

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
          <p className="mt-1 text-sm text-slate-500">{registering ? role === 'seller' ? 'Create your storefront account, then submit documents for approval.' : 'Buyers can start shopping with their name, email and phone. Identity document review is optional.' : 'Sign in to your VeriPay account.'}</p>
        </div>
        {message && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{message}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg bg-brand-50 p-3 text-xs text-brand-800">{notice}</p>}
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
            <div className="relative">
              <input id="signin-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete={registering?'new-password':'current-password'} required minLength={registering?10:undefined} maxLength={registering?128:256} disabled={busy}
                placeholder="Enter your password" className="w-full rounded-lg border border-slate-300 py-2.5 pl-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <button type="button" aria-controls="signin-password" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-slate-600">
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
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
        {!registering && <a href="/forgot-password" className="mt-4 block rounded-lg bg-brand-50 px-4 py-3 text-center text-sm font-bold text-brand-800 underline">Forgot password?</a>}
        <a href="/getting-started" className="mt-4 block text-center text-sm font-semibold text-brand-700 underline">New to VeriPay? See how it works</a>
        {registering ? <button type="button" disabled={busy} onClick={()=>changeMode(false)} className="mt-4 w-full text-xs font-semibold text-brand-600 hover:underline">Already have an account? Sign in</button> : <button type="button" disabled={busy} onClick={()=>changeMode(true)} className="mt-4 w-full rounded-lg border border-brand-600 px-4 py-3 text-sm font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50">Register on VeriPay</button>}
        {!registering && demo && <details className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold text-slate-600">Demo accounts</summary>
          <p className="mt-3 leading-relaxed">{demo.enabled === false ? 'The demo host needs to configure access to these accounts.' : <>Choose an account to fill in its email. {demo.demoPassword ? <>Demo password <code className="text-slate-800">{demo.demoPassword}</code></> : 'Use the password provided by the demo host.'}</>}</p>
          <div className="mt-3 grid gap-2">
            {demo.accounts.map(account => <button key={account.email} type="button" disabled={busy || demo.enabled === false}
              onClick={() => { setEmail(account.email); setPassword(demo.demoPassword || ''); setError(''); }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-left text-brand-600 hover:bg-brand-50"><span className="font-semibold capitalize">{account.role === 'admin' ? 'Reviewer (admin)' : account.role}</span><span className="block break-all text-slate-600">{account.email}</span></button>)}
          </div>
        </details>}
      </section>
    </div>
  </main>;
}

function ResetPasswordPanel({ onBack }: { onBack: (changed: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [requestNotice, setRequestNotice] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const field = 'block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm';

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(''); setRequestNotice('');
    try { setRequestNotice(await api.requestPasswordRecovery(email)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not request help'); }
    finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) { setError('Passwords do not match'); return; }
    setBusy(true);
    setError('');
    try {
      await api.resetPassword(code.trim(), password);
      onBack(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
    <section className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <BrandLogo size="signin" />
      <h1 className="text-xl font-bold">Reset your password</h1>
      <p className="text-sm text-slate-600">Enter your account email to request recovery help. VeriPay support verifies your identity and shares a single-use code. For demo accounts, ask the demo host for the current credentials.</p>
      <form onSubmit={requestCode} className="space-y-3 border-b border-slate-200 pb-5">
        <label className="block text-sm font-medium">Account email<input className={field} type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" maxLength={254} required /></label>
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand-700 p-3 text-sm font-bold text-white disabled:opacity-50">Request recovery help</button>
        {requestNotice && <p role="status" className="text-sm text-brand-800">{requestNotice}</p>}
      </form>
      <h2 className="font-bold text-slate-900">Already have a recovery code?</h2>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">Recovery code<input className={field} value={code} onChange={event => setCode(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={64} required /></label>
        <label className="block text-sm font-medium">New password<input className={field} type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={10} maxLength={128} required /></label>
        <label className="block text-sm font-medium">Confirm new password<input className={field} type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" minLength={10} maxLength={128} required /></label>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand-600 p-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Updating…' : 'Set new password'}</button>
      </form>
      <button type="button" disabled={busy} onClick={() => onBack(false)} className="text-sm font-semibold text-brand-700 hover:underline">Back to sign in</button>
    </section>
  </main>;
}
