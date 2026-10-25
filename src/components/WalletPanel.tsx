import React, { useEffect, useState } from 'react';
import { api } from '../client/api.ts';

export function WalletPanel({canTopup, revision}: {canTopup:boolean;revision:string}) {
  const [wallet,setWallet] = useState<Awaited<ReturnType<typeof api.getWallet>> | null>(null);
  const [amount,setAmount] = useState('100000');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  useEffect(()=>{
    let active = true;
    api.getWallet().then(value=>{if(active)setWallet(value);}).catch(error=>{if(active)setError(error.message);});
    return ()=>{active=false;};
  },[revision]);
  const money = (value:number) => new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(value);
  return <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">Sandbox wallet · no real money</p>
        <p className="text-xs text-slate-600 mt-1">{wallet ? `${money(wallet.available)} available · ${money(wallet.held)} held in escrow` : 'Loading balance…'}</p>
      </div>
      {canTopup && wallet?.mode === 'sandbox' && <form className="flex items-center gap-2" onSubmit={async event=>{
        event.preventDefault();setBusy(true);setError('');
        try {setWallet(await api.topupWallet(Number(amount)));} catch(error){setError((error as Error).message);} finally{setBusy(false);}
      }}>
        <label className="text-xs text-slate-600" htmlFor="sandbox-topup">Add test funds (₦)</label>
        <input id="sandbox-topup" type="number" min="0.01" max="1000000000" step="0.01" required value={amount} onChange={event=>setAmount(event.target.value)} className="w-32 rounded-lg border border-slate-300 p-2 text-sm" />
        <button disabled={busy} className="px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold disabled:opacity-50">{busy?'Adding…':'Add test funds'}</button>
      </form>}
    </div>
    {wallet?.mode === 'disabled' && <p className="text-xs text-slate-600">Payments are disabled until a payment provider is configured.</p>}
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
  </div>;
}
