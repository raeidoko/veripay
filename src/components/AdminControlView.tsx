import React, { useEffect, useState } from 'react';
import { api } from '../client/api.ts';
import { AdminUserProfileView } from './AdminUserProfileView.tsx';
import type { AdminControlState, PlatformSettings, UserProfile } from '../shared/types.ts';

const button = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40';
const badge = 'rounded-md bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-800';
export function AdminControlView({onChanged,currentUser}: {onChanged:()=>void;currentUser:UserProfile}) {
  const [data,setData] = useState<AdminControlState|null>(null);
  const [tab,setTab] = useState('Overview');
  const [query,setQuery] = useState('');
  const [userRole,setUserRole] = useState<'all'|'buyer'|'seller'>('all');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [settings,setSettings] = useState<PlatformSettings|null>(null);
  const [action,setAction] = useState<{path:string; title:string; body:Record<string,unknown>}|null>(null);
  const [notes,setNotes] = useState('');
  const [selectedUserId,setSelectedUserId] = useState<string|null>(null);
  const [profileRevision,setProfileRevision] = useState(0);
  async function load() {
    try { const result = await api.getAdminControl(); setData(result); setSettings(result.settings); }
    catch(err) { setError(err instanceof Error ? err.message : 'Could not load admin controls'); }
  }
  useEffect(()=>{load();},[]);
  function choose(path:string,title:string,body:Record<string,unknown>) { setAction({path,title,body}); setNotes(''); setError(''); setNotice(''); }
  async function submit(event:React.FormEvent) {
    event.preventDefault(); if(!action) return;
    setBusy(true); setError('');
    try { await api.adminAction(action.path,{...action.body,notes}); setAction(null); await load(); setProfileRevision(value=>value+1); onChanged(); setNotice('Admin decision saved and recorded in the audit trail.'); }
    catch(err) { setError(err instanceof Error ? err.message : 'Action failed'); }
    finally {setBusy(false);}
  }
  async function saveSettings(event:React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {await api.adminAction('settings',settings); await load(); onChanged(); setNotice('Platform settings saved.');}
    catch(err){setError(err instanceof Error ? err.message : 'Could not save settings');}
    finally{setBusy(false);}
  }
  const matches=(text:string)=>text.toLowerCase().includes(query.toLowerCase());
  const filteredUsers=data?.users.filter(user=>(userRole==='all'||user.role===userRole)&&matches(user.name+' '+user.email+' '+user.role+' '+user.accountStatus))||[];
  return <div className="space-y-5">
    {selectedUserId && data ? <>
      {notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
      <AdminUserProfileView key={selectedUserId} userId={selectedUserId} admin={currentUser} catalog={data.products} revision={profileRevision}
        onBack={()=>{setSelectedUserId(null);setNotice('');}} onAction={item=>choose(item.path,item.title,item.body)}
        onChanged={()=>{load();onChanged();}} />
    </> : <>
    <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-start justify-between gap-4">
      <div><p className="text-xs font-semibold text-brand-600">Platform administration</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Control Centre</h1><p className="mt-2 text-xs leading-relaxed text-slate-500">Approve accounts and documents, manage the marketplace, and track every admin decision.</p></div>
      <button type="button" onClick={load} className={button}>Refresh</button>
    </div>
    <nav aria-label="Admin controls" className="flex gap-2 overflow-x-auto">
      {['Overview','Users','Documents','Products','Reviews','Settings'].map(item=><button key={item} type="button" onClick={()=>{setTab(item);setQuery('');setNotice('');setError('');}} aria-current={tab===item?'page':undefined} className={`${button} whitespace-nowrap ${tab===item?'!bg-brand-600 !text-white':''}`}>{item}</button>)}
    </nav>
    {notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
    {error&&!action&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    {!data?<p role="status" className="text-sm text-slate-500">Loading platform controls…</p>:<>
      {tab==='Overview'&&<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[
          ['Pending users',data.totals.pendingUsers],['Documents to review',data.totals.pendingDocuments],['Listings to approve',data.totals.pendingProducts],['Open disputes',data.totals.openDisputes]
        ].map(([title,value])=><div key={title} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">{title}</p><strong className="mt-2 block text-3xl text-slate-900">{value}</strong></div>)}</div>
        <div className="rounded-xl bg-slate-900 p-6 text-white"><h2 className="font-bold">Platform overview</h2><p className="mt-3 text-sm text-brand-100">{data.totals.users} accounts · {data.totals.orders} orders · ₦{data.totals.escrowHeld.toLocaleString('en-NG')} in active escrow</p><p className="mt-3 text-xs text-brand-200">New purchases: {data.settings.purchasesPaused?'Paused':'Enabled'} · Product approval: {data.settings.requireProductApproval?'Required':'Automatic'}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-xs leading-relaxed text-slate-600"><strong className="block text-slate-900 mb-2">Approval workflow</strong>Review the uploaded identity document, record your decision, then approve the account. Use the dispute and risk workspaces for delivery checks, escrow decisions, and identity flags.</div>
      </>}
      {!['Overview','Settings'].includes(tab)&&<input aria-label={`Search ${tab.toLowerCase()}`} value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${tab.toLowerCase()}…`} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"/>}
      {tab==='Users'&&<div className="space-y-3">
        <div role="group" aria-label="Filter users by account type" className="flex flex-wrap gap-2">
          {([{value:'all',label:'All users'},{value:'buyer',label:'Buyers'},{value:'seller',label:'Sellers'}] as const).map(filter=><button key={filter.value} type="button" aria-pressed={userRole===filter.value} onClick={()=>setUserRole(filter.value)} className={`${button} ${userRole===filter.value?'!bg-brand-600 !text-white':''}`}>{filter.label} ({data.users.filter(user=>filter.value==='all'||user.role===filter.value).length})</button>)}
        </div>
        {filteredUsers.length===0&&<p role="status" className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">No {userRole==='buyer'?'buyers':userRole==='seller'?'sellers':'users'} match your filters.</p>}
        {filteredUsers.map(user=><article key={user.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-bold text-slate-900"><button type="button" onClick={()=>{setSelectedUserId(user.id);setNotice('');}} className="text-brand-700 hover:underline text-left">{user.name}</button></h2><p className="text-xs text-slate-500 mt-1">{user.email} · {user.role}</p></div><span className={badge}>{user.accountStatus||'APPROVED'}</span></div>
        <p className="text-xs text-slate-500">{data.documents.filter(doc=>doc.userId===user.id).length} documents submitted · Identity: {user.identityVerified?'Reviewed / verified':'Not verified'}</p>
        <button type="button" className={button} onClick={()=>{setSelectedUserId(user.id);setNotice('');}}>View profile & records</button>
        {user.approvalNotes&&<p className="text-xs text-slate-600">Admin notes: {user.approvalNotes}</p>}
        {user.role!=='admin'&&<div className="flex flex-wrap gap-2">{['APPROVED','PENDING','SUSPENDED','REJECTED'].filter(status=>status!==user.accountStatus).map(status=><button key={status} className={button} onClick={()=>choose(`users/${user.id}/status`,`${status==='APPROVED'?'Approve':status==='PENDING'?'Return to pending':status==='SUSPENDED'?'Suspend':'Reject'} ${user.name}`,{status})}>{status==='APPROVED'?'Approve account':status==='PENDING'?'Request review':status==='SUSPENDED'?'Suspend account':'Reject account'}</button>)}</div>}
      </article>)}</div>}
      {tab==='Documents'&&<div className="space-y-3">{data.documents.length===0&&<p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">No verification documents submitted yet.</p>}{data.documents.filter(doc=>matches(doc.userName+' '+doc.kind+' '+doc.status)).map(doc=><article key={doc.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex justify-between gap-4"><div><h2 className="font-bold text-sm text-slate-900">{doc.userName} · {doc.kind}</h2><p className="text-xs text-slate-500 mt-1 break-all">{doc.originalName} · {new Date(doc.uploadedAt).toLocaleDateString()}</p></div><span className={badge}>{doc.status}</span></div>
        <a href={`/api/verification/documents/${doc.id}/file`} className="inline-block text-xs font-semibold text-brand-600 underline">Download document for review</a>
        {doc.notes&&<p className="text-xs text-slate-600">{doc.reviewedBy}: {doc.notes}</p>}
        {doc.status==='PENDING'&&<div className="flex gap-2">{['APPROVED','REJECTED'].map(status=><button key={status} className={button} onClick={()=>choose(`documents/${doc.id}/review`,`${status==='APPROVED'?'Approve':'Reject'} ${doc.kind.toLowerCase()} document for ${doc.userName}`,{status})}>{status==='APPROVED'?'Approve document':'Reject document'}</button>)}</div>}
      </article>)}</div>}
      {tab==='Products'&&<div className="space-y-3">{data.products.filter(product=>matches(product.name+' '+product.sellerName+' '+product.moderationStatus)).map(product=><article key={product.id} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row gap-4">
        <img src={product.imageUrl} alt={product.name} className="h-20 w-24 rounded-lg object-cover"/><div className="flex-1 space-y-2"><h2 className="text-sm font-bold text-slate-900">{product.name}</h2><p className="text-xs text-slate-500">{product.sellerName} · ₦{product.price.toLocaleString('en-NG')}</p><span className={badge}>{product.moderationStatus||'PUBLISHED'}</span>{product.moderationNotes&&<p className="text-xs text-slate-500">{product.moderationNotes}</p>}</div>
        <div className="flex items-center gap-2">{product.moderationStatus!=='PUBLISHED'&&<button className={button} onClick={()=>choose(`products/${product.id}/moderate`,'Publish '+product.name,{status:'PUBLISHED'})}>Approve & publish</button>}{product.moderationStatus!=='HIDDEN'&&<button className={button} onClick={()=>choose(`products/${product.id}/moderate`,'Hide '+product.name,{status:'HIDDEN'})}>Hide listing</button>}</div>
      </article>)}</div>}
      {tab==='Reviews'&&<div className="space-y-3">{data.reviews.length===0&&<p className="rounded-xl bg-white p-8 text-sm text-center text-slate-500">No buyer reviews submitted yet.</p>}{data.reviews.filter(review=>matches(review.comment+' '+review.buyerName)).map(review=><article key={review.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-2"><h2 className="text-sm font-bold text-slate-900">{review.buyerName} · {review.rating}/5</h2><p className="text-xs text-slate-500">{data.products.find(product=>product.id===review.productId)?.name}</p><p className="text-sm text-slate-600 break-words">{review.comment}</p><button className={button} onClick={()=>choose(`reviews/${review.id}/moderate`,review.hidden?'Restore buyer review':'Hide buyer review',{hidden:!review.hidden})}>{review.hidden?'Restore review':'Hide review'}</button></article>)}</div>}
      {tab==='Settings'&&settings&&<form onSubmit={saveSettings} className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <h2 className="font-bold text-slate-900">Marketplace settings</h2>
        <label className="flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={settings.purchasesPaused} onChange={e=>setSettings({...settings,purchasesPaused:e.target.checked})}/><span>Pause new purchases<span className="block text-xs mt-1 text-slate-500">Existing order fulfilment and disputes continue.</span></span></label>
        <label className="flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={settings.requireProductApproval} onChange={e=>setSettings({...settings,requireProductApproval:e.target.checked})}/><span>Require approval for new or edited listings</span></label>
        <label className="block text-xs font-semibold text-slate-700">Platform announcement<textarea maxLength={300} value={settings.announcement} onChange={e=>setSettings({...settings,announcement:e.target.value})} rows={3} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" placeholder="Message displayed to signed-in users"/></label>
        <button disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?'Saving…':'Save settings'}</button>
      </form>}
    </>}
    </>}
    {action&&<div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"><form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="admin-action-heading" className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4"><h2 id="admin-action-heading" className="font-bold text-slate-900">{action.title}</h2><label className="block text-xs font-semibold text-slate-700">Reason / review notes<textarea autoFocus required minLength={3} maxLength={1000} rows={3} value={notes} onChange={e=>setNotes(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"/></label>{error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={()=>setAction(null)} className={button}>Cancel</button><button disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy?'Saving…':'Confirm decision'}</button></div></form></div>}
  </div>;
}
