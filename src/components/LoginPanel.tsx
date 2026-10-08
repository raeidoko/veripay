import React, { useState } from 'react';
import { LockKeyhole, ShieldCheck, Smartphone, UserRound } from 'lucide-react';
import VeriPayLogo from './VeriPayLogo';
import { AuthUser } from '../types';

interface LoginPanelProps {
  onLogin: (phone: string, password: string) => Promise<void>;
}

const demoAccounts: Array<Pick<AuthUser, 'name' | 'phone' | 'role'>> = [
  { name: 'Femi Adebayo', phone: '+234 802 888 7766', role: 'BUYER' },
  { name: 'Amara Couture', phone: '+234 803 111 2222', role: 'SELLER' },
  { name: 'VeriPay Operations', phone: '+234 800 000 0000', role: 'ARBITRATOR' },
];

export default function LoginPanel({ onLogin }: LoginPanelProps) {
  const [phone, setPhone] = useState(demoAccounts[0].phone);
  const [password, setPassword] = useState('1234');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await onLogin(phone, password);
    } catch {
      setError('Invalid phone number or PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F1F5F9] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-5 bg-[#0F172A] text-white rounded-2xl p-8 flex flex-col justify-between shadow-xl">
          <div className="space-y-8">
            <VeriPayLogo size="lg" showSubtitle={true} />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Secure Session Gateway</span>
              <h1 className="text-3xl font-black tracking-tight mt-3 leading-tight">Protected escrow access for every role.</h1>
              <p className="text-sm text-slate-300 leading-relaxed mt-4">
                Sign in as a buyer, merchant, or arbitrator to continue managing protected transactions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-8">
            {['Buyer', 'Seller', 'Mediator'].map((label) => (
              <div key={label} className="border border-white/10 bg-white/5 rounded-xl px-3 py-3">
                <ShieldCheck className="w-4 h-4 text-emerald-300 mb-2" />
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-300">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 mb-7">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">VeriPay Login</span>
              <h2 className="text-xl font-extrabold text-slate-900 mt-1">Access your workspace</h2>
            </div>
            <div className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center">
              <LockKeyhole className="w-5 h-5" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase">Phone Number</label>
              <div className="relative">
                <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase">Wallet PIN</label>
              <div className="relative">
                <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="password"
                  inputMode="numeric"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-xl px-4 py-3 text-xs font-semibold">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In Securely'}
            </button>
          </form>

          <div className="mt-7 pt-6 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3">Demo Access</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {demoAccounts.map((account) => (
                <button
                  key={account.phone}
                  type="button"
                  onClick={() => {
                    setPhone(account.phone);
                    setPassword('1234');
                    setError('');
                  }}
                  className="text-left border border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/40 rounded-xl p-3 transition-colors cursor-pointer"
                >
                  <UserRound className="w-4 h-4 text-[#2563EB] mb-2" />
                  <span className="font-bold text-slate-800 text-xs block">{account.name}</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">{account.role}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
