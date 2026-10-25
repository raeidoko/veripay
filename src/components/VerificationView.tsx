import React, { useEffect, useState } from 'react';
import { api } from '../client/api.ts';
import type { UserProfile, VerificationDocument } from '../shared/types.ts';

export function VerificationView({onUserUpdated}: {onUserUpdated:(user:UserProfile)=>void}) {
  const [data,setData] = useState<{user:UserProfile;documents:VerificationDocument[]}|null>(null);
  const [kind,setKind] = useState('IDENTITY');
  const [file,setFile] = useState<File|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  async function load(refreshUser=false){try{const result=await api.getVerification();setData(result);if(refreshUser)onUserUpdated(result.user);}catch(err){setError(err instanceof Error?err.message:'Could not load verification');}}
  useEffect(()=>{load();},[]);
  async function upload(event:React.FormEvent){event.preventDefault();if(!file)return;setBusy(true);setError('');setNotice('');try{await api.uploadVerification(file,kind);setFile(null);await load();setNotice('Document submitted. An administrator will review it.');}catch(err){setError(err instanceof Error?err.message:'Upload failed');}finally{setBusy(false);}}
  return <div className="max-w-3xl mx-auto space-y-5">
    <header className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-semibold text-brand-600">Account verification</p><h1 className="mt-1 text-2xl font-bold text-slate-900">My documents & approval</h1><p className="mt-2 text-sm text-slate-500">Submit your identity, business, or address documents for admin review. Files are accessible only to you and the admin.</p>{data&&<><p className="mt-4 text-xs font-semibold text-brand-700">Account status: {data.user.accountStatus||'APPROVED'}</p>{data.user.approvalNotes&&<p className="mt-2 text-xs text-slate-600">Admin notes: {data.user.approvalNotes}</p>}</>}<button type="button" onClick={()=>load(true)} className="mt-3 text-xs font-semibold text-brand-600 underline">Refresh approval status</button></header>
    <form onSubmit={upload} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
      <label className="block text-xs font-semibold text-slate-700">Document type<select value={kind} onChange={e=>setKind(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 p-2 text-sm"><option value="IDENTITY">Identity document</option><option value="BUSINESS">Business registration</option><option value="ADDRESS">Proof of address</option><option value="OTHER">Other supporting document</option></select></label>
      <label className="block text-xs font-semibold text-slate-700">Choose document<input type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} className="mt-2 block w-full text-xs" onChange={e=>{const item=e.target.files?.[0];e.target.value='';setError('');if(!item)return;if(!['application/pdf','image/jpeg','image/png'].includes(item.type)){setError('Choose a PDF, JPG, or PNG file');return;}if(item.size>10*1024*1024){setError('Documents must be 10 MB or smaller');return;}setFile(item);}}/></label>
      <p className="text-xs text-slate-500">PDF, JPG, or PNG · Maximum 10 MB{file&&<span className="block mt-1 break-all">Selected: {file.name}</span>}</p>
      <button disabled={!file||busy} className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy?'Uploading…':'Submit for review'}</button>
    </form>
    {error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}{notice&&<p role="status" className="text-xs text-emerald-700">{notice}</p>}
    <section className="space-y-3"><h2 className="text-sm font-bold text-slate-900">Submitted documents</h2>{data?.documents.length===0&&<p className="rounded-xl bg-white p-5 text-sm text-slate-500">You have not submitted any documents yet.</p>}{data?.documents.map(doc=><article key={doc.id} className="rounded-xl border border-slate-200 bg-white p-5 text-xs space-y-2"><div className="flex justify-between gap-3"><strong className="text-slate-800">{doc.kind}</strong><span className="font-bold text-brand-700">{doc.status}</span></div><p className="text-slate-500 break-all">{doc.originalName} · {new Date(doc.uploadedAt).toLocaleDateString()}</p><a className="inline-block font-semibold text-brand-600 underline" href={`/api/verification/documents/${doc.id}/file`}>Download your document</a>{doc.notes&&<p className="text-slate-600">Admin review: {doc.notes}</p>}</article>)}</section>
  </div>;
}
