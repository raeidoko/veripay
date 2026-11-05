import React, { useState } from 'react';
import type { UserRole } from '../shared/types.ts';
import { BrandLogo } from './BrandLogo.tsx';

const guides = {
  buyer: [
    ['Create your buyer account', 'Register with your name, email, phone and a password. Buyers can start shopping immediately. Identity document review is optional.'],
    ['Review what you are buying', 'Browse Shop or ask the AI assistant. Check the item, seller, delivery terms and total before confirming. VeriPay saves the agreement as purchase evidence.'],
    ['Track delivery and get help', 'Use My Purchases to track your order and confirm receipt after checking the item. Open My Disputes if something is wrong. A reviewer considers the evidence before deciding.'],
  ],
  seller: [
    ['Create and verify your account', 'Register your business and contact details. Submit documents in Verification. You can explore your workspace while an administrator reviews them.'],
    ['List products after approval', 'Use My Storefront to describe products, prices and delivery terms accurately. Approval is required before trading.'],
    ['Fulfil orders and respond to problems', 'Track Sales & Dispatch and register a rider or logistics contact before dispatch. Use My Disputes to respond to evidence requests. A human reviewer makes the final dispute decision.'],
  ],
};

export function GettingStartedView({ role, onContinue }: { role?: UserRole; onContinue?: () => void }) {
  const [audience, setAudience] = useState<'buyer' | 'seller'>(role === 'seller' ? 'seller' : 'buyer');
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12"><div className="mx-auto max-w-3xl space-y-6">
    <header className="space-y-4"><BrandLogo size="signin" /><p className="text-sm font-bold text-brand-700">Getting started with VeriPay</p><h1 className="text-3xl font-bold tracking-tight text-slate-900">Shop, sell and follow every step.</h1><p className="text-base leading-relaxed text-slate-600">VeriPay records your purchase agreement and tracks payment and delivery. Escrow holds the payment while the order is fulfilled, and reviewers help resolve disputes.</p>
      <div role="group" aria-label="Choose a getting started guide" className="flex gap-3">{(['buyer', 'seller'] as const).map(item => <button key={item} type="button" aria-pressed={audience === item} onClick={() => setAudience(item)} className={`rounded-xl px-5 py-3 text-sm font-bold ${audience === item ? 'bg-brand-700 text-white' : 'border border-slate-300 bg-white text-slate-800'}`}>For {item}s</button>)}</div>
    </header>
    <ol className="space-y-4">{guides[audience].map(([title, text], index) => <li key={title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-800">{index + 1}</span><div><h2 className="text-base font-bold text-slate-900">{title}</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p></div></li>)}</ol>
    <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-sm leading-relaxed text-brand-900"><h2 className="font-bold">Returning to your account</h2><p className="mt-2">Use the same email and password each time you sign in. Signing out keeps your account and history. If you forget your password, open <a className="font-bold underline" href="/forgot-password">Forgot password</a> to request recovery help or use a recovery code.</p><p className="mt-2">Demo payments use simulated funds.</p></section>
    {onContinue ? <button type="button" onClick={onContinue} className="w-full rounded-xl bg-brand-700 px-5 py-4 font-bold text-white">Continue to my workspace</button> : <div className="grid gap-3 sm:grid-cols-2"><a href="/register" className="rounded-xl bg-brand-700 px-5 py-4 text-center font-bold text-white">Create an account</a><a href="/login" className="rounded-xl border border-brand-700 bg-white px-5 py-4 text-center font-bold text-brand-700">I already have an account</a></div>}
  </div></main>;
}
