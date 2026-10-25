import React, { useEffect, useState } from 'react';
import { api } from '../client/api.ts';
import type { AdminControlState, AdminUserProfile, Dispute, ProductReview, UserProfile, VerificationDocument } from '../shared/types.ts';
import { DisputeDetailView } from './DisputeDetailView.tsx';

export interface AdminProfileAction {path:string;title:string;body:Record<string,unknown>}
const button='rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40';
const panel='rounded-xl border border-slate-200 bg-white p-5 space-y-3';
const badge='inline-block rounded-md bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-800';
const labels:Record<string,string>={IDENTITY:'NIN / identity document',BUSINESS:'CAC / business certificate',ADDRESS:'Proof of address',OTHER:'Supporting document'};
const money=(value:number)=>'₦'+value.toLocaleString('en-NG');
const date=(value:string)=>new Date(value).toLocaleString();

export function AdminUserProfileView({userId,admin,catalog,revision,onBack,onAction,onChanged}:{
  userId:string;admin:UserProfile;catalog:AdminControlState['products'];revision:number;
  onBack:()=>void;onAction:(action:AdminProfileAction)=>void;onChanged:()=>void;
}) {
  const [profile,setProfile]=useState<AdminUserProfile|null>(null);
  const [tab,setTab]=useState('Details');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [reload,setReload]=useState(0);
  const [preview,setPreview]=useState<VerificationDocument|null>(null);
  const [dispute,setDispute]=useState<Dispute|null>(null);
  useEffect(()=>{
    let cancelled=false;setLoading(true);setError('');setPreview(null);
    api.getAdminUserProfile(userId).then(result=>{if(!cancelled)setProfile(result);})
      .catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'Could not load this account');})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[userId,revision,reload]);
  const refresh=()=>setReload(value=>value+1);
  const decide=(path:string,title:string,body:Record<string,unknown>)=>onAction({path,title,body});
  const reviews=(items:ProductReview[],received:boolean)=>items.length===0?<Empty text={received?'No reviews have been left on this seller’s products.':'This user has not written any product reviews.'}/>:<div className="space-y-3">{items.map(review=><article key={review.id} className={panel}>
    <div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-bold text-slate-900">{catalog.find(product=>product.id===review.productId)?.name||'Product '+review.productId}</h3><span className={badge}>{review.rating}/5 · {review.hidden?'Hidden':'Visible'}</span></div>
    <p className="text-xs text-slate-500">Written by {review.buyerName} · {date(review.createdAt)}{review.createdAt!==review.updatedAt?' · Updated '+date(review.updatedAt):''}</p>
    <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{review.comment}</p>
    <button className={button} onClick={()=>decide(`reviews/${review.id}/moderate`,review.hidden?'Restore this review':'Hide this review',{hidden:!review.hidden})}>{review.hidden?'Restore review':'Hide review'}</button>
  </article>)}</div>;
  if(dispute)return <div className="space-y-4"><p className="text-xs font-semibold text-brand-700">User profile: {profile?.user.name}</p><DisputeDetailView dispute={dispute} userRole="admin" currentUserId={admin.id} currentUserName={admin.name} onBack={()=>{setDispute(null);refresh();}} onUpdated={updated=>{setDispute(updated);refresh();onChanged();}}/></div>;
  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3"><button type="button" className={button} onClick={onBack}>← Back to users</button><button type="button" disabled={loading} className={button} onClick={refresh}>Refresh profile</button></div>
    {loading?<p role="status" className="p-6 text-sm text-slate-500">Loading user profile…</p>:error?<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:profile&&<>
      <header className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{profile.user.role} account</p>
        <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold text-slate-900">{profile.user.name}</h1><span className={badge}>{profile.user.accountStatus||'APPROVED'}</span></div>
        <p className="text-sm text-slate-500 break-all">{profile.user.email} · {profile.user.phone}</p>
        <p className="text-xs text-slate-500">All records below belong to this account or its products and orders.</p>
      </header>
      <nav aria-label="User profile sections" className="flex gap-2 overflow-x-auto pb-1">{[
        ['Details',null],['Documents',profile.documents.length],['Products',profile.products.length],['Reviews written',profile.reviewsWritten.length],['Reviews received',profile.reviewsReceived.length],['Orders',profile.orders.length],['Disputes',profile.disputes.length],['Activity',profile.activity.length]
      ].map(([name,count])=><button type="button" key={name} aria-current={tab===name?'page':undefined} onClick={()=>{setTab(String(name));setPreview(null);}} className={`${button} whitespace-nowrap ${tab===name?'!bg-brand-600 !text-white':''}`}>{name}{count!==null?` (${count})`:''}</button>)}</nav>
      {tab==='Details'&&<section className={panel}>
        <h2 className="text-sm font-bold text-slate-900">Account details</h2>
        <dl className="grid sm:grid-cols-2 gap-4 text-xs">{[
          ['Account ID',profile.user.id],['Role',profile.user.role],['Email',profile.user.email],['Phone',profile.user.phone],['Identity status',profile.user.identityVerified?'Verified / manually reviewed':'Not verified'],['Verification methods',profile.user.identityMethods.join(', ')||'None'],['Account restriction',profile.user.isRestricted?'Restricted':'No restriction flag'],['Restriction reason',profile.user.restrictionReason||'None']
        ].map(([name,value])=><div key={name}><dt className="text-slate-400">{name}</dt><dd className="mt-1 break-words font-medium text-slate-700">{value}</dd></div>)}</dl>
        {profile.user.approvalNotes&&<p className="text-xs text-slate-600">Admin notes: {profile.user.approvalNotes}</p>}
        {profile.user.role!=='admin'&&<div className="border-t border-slate-100 pt-3 flex flex-wrap gap-2">{['APPROVED','PENDING','SUSPENDED','REJECTED'].filter(status=>status!==profile.user.accountStatus).map(status=><button type="button" key={status} className={button} onClick={()=>decide(`users/${profile.user.id}/status`,`${status==='APPROVED'?'Approve':status==='PENDING'?'Request review for':status==='SUSPENDED'?'Suspend':'Reject'} ${profile.user.name}`,{status})}>{status==='APPROVED'?'Approve account':status==='PENDING'?'Request review':status==='SUSPENDED'?'Suspend account':'Reject account'}</button>)}</div>}
      </section>}
      {tab==='Documents'&&<div className="space-y-3">
        {profile.documents.length===0&&<Empty text="This user has not uploaded any verification documents."/>}
        {profile.documents.map(doc=><article key={doc.id} className={panel}>
          <div className="flex flex-wrap justify-between gap-3"><h2 className="text-sm font-bold text-slate-900">{labels[doc.kind]}</h2><span className={badge}>{doc.status}</span></div>
          <p className="break-all text-xs text-slate-500">{doc.originalName} · {(doc.size/1024).toFixed(0)} KB · Uploaded {date(doc.uploadedAt)}</p>
          <div className="flex flex-wrap items-center gap-3"><button className={button} onClick={()=>setPreview(preview?.id===doc.id?null:doc)}>{preview?.id===doc.id?'Close document':'View document'}</button><a href={`/api/verification/documents/${doc.id}/file`} className="text-xs font-semibold text-brand-600 underline">Download original</a></div>
          {preview?.id===doc.id&&<div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
            {doc.mimeType==='application/pdf'?<><iframe title={`Document preview: ${doc.originalName}`} src={`/api/verification/documents/${doc.id}/file?preview=1`} className="h-[65vh] min-h-80 w-full bg-white"/><p className="p-3 text-xs text-slate-500">If your browser cannot preview this PDF, use Download original.</p></>:<img src={`/api/verification/documents/${doc.id}/file?preview=1`} alt={`Uploaded ${labels[doc.kind]} for ${profile.user.name}`} className="max-h-[70vh] w-full object-contain"/>}
          </div>}
          {doc.reviewedBy&&<p className="text-xs text-slate-500">Reviewed by {doc.reviewedBy}{doc.reviewedAt?' · '+date(doc.reviewedAt):''}</p>}
          {doc.notes&&<p className="text-xs text-slate-700">Review notes: {doc.notes}</p>}
          {doc.status==='PENDING'&&<div className="flex flex-wrap gap-2"><button className={button} onClick={()=>decide(`documents/${doc.id}/review`,'Approve '+labels[doc.kind]+' for '+profile.user.name,{status:'APPROVED'})}>Approve document</button><button className={button} onClick={()=>decide(`documents/${doc.id}/review`,'Reject '+labels[doc.kind]+' for '+profile.user.name,{status:'REJECTED'})}>Reject document</button></div>}
        </article>)}
      </div>}
      {tab==='Products'&&<div className="space-y-3">{!profile.products.length&&<Empty text="This user has no product listings."/>}{profile.products.map(product=><article key={product.id} className={panel}>
        <div className="flex flex-col sm:flex-row gap-4"><img src={product.imageUrl} alt={product.name} className="h-32 w-40 rounded-lg object-cover"/><div className="space-y-2"><h2 className="text-sm font-bold text-slate-900">{product.name}</h2><p className="text-xs text-slate-500">{product.category} · {money(product.price)} · {product.stock} in stock</p><span className={badge}>{product.moderationStatus||'PUBLISHED'}</span><p className="text-xs text-slate-600 whitespace-pre-wrap">{product.description}</p></div></div>
        <p className="text-xs text-slate-600">Delivery: {product.deliveryTerms}</p>{product.moderationNotes&&<p className="text-xs text-slate-600">Admin notes: {product.moderationNotes}</p>}
        <div className="flex flex-wrap gap-2">{product.moderationStatus!=='PUBLISHED'&&<button className={button} onClick={()=>decide(`products/${product.id}/moderate`,'Publish '+product.name,{status:'PUBLISHED'})}>Approve & publish</button>}{product.moderationStatus!=='HIDDEN'&&<button className={button} onClick={()=>decide(`products/${product.id}/moderate`,'Hide '+product.name,{status:'HIDDEN'})}>Hide listing</button>}<button className={button} onClick={()=>setTab('Reviews received')}>View customer reviews</button></div>
      </article>)}</div>}
      {tab==='Reviews written'&&reviews(profile.reviewsWritten,false)}
      {tab==='Reviews received'&&reviews(profile.reviewsReceived,true)}
      {tab==='Orders'&&<div className="space-y-3">{!profile.orders.length&&<Empty text="This user has no orders or transactions."/>}{profile.orders.map(order=><article key={order.id} className={panel}>
        <div className="flex flex-wrap justify-between gap-2"><h2 className="text-sm font-bold text-slate-900">{order.orderNumber}</h2><span className={badge}>{order.state.replaceAll('_',' ')}</span></div>
        <p className="text-xs text-slate-500">Buyer: {order.buyerName} · Seller: {order.sellerName} · {date(order.createdAt)}</p>
        <p className="text-sm font-semibold text-slate-800">Total {money(order.totalAmount)} · Escrow fee {money(order.escrowFee)}</p>
        <details className="text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-brand-600">View order details</summary><div className="mt-3 space-y-3">{order.items.map((item,index)=><div key={index} className="flex gap-3 items-center"><img src={item.imageUrl} alt={item.productName} className="h-12 w-12 rounded object-cover"/><p>{item.productName} · {item.variantName||'Standard'} · Qty {item.quantity} · {money(item.subtotal)}</p></div>)}<p>Delivery address: {order.deliveryAddress}</p><p>Terms: {order.deliveryTerms}</p><p>Purchase snapshot: {order.purchaseSnapshotId||'Not sealed'}</p><p>Courier record: {order.dispatchContactId||'Not registered'}</p></div></details>
      </article>)}</div>}
      {tab==='Disputes'&&<div className="space-y-3">{!profile.disputes.length&&<Empty text="There are no disputes linked to this user’s orders."/>}{profile.disputes.map(item=><article key={item.id} className={panel}><div className="flex flex-wrap justify-between gap-2"><h2 className="text-sm font-bold text-slate-900">{item.id} · {item.reason.replaceAll('_',' ')}</h2><span className={badge}>{item.state.replaceAll('_',' ')}</span></div><p className="text-xs text-slate-500">Order {item.orderNumber} · Filed by {item.openerName} · {money(item.claimedAmount)}</p><p className="text-sm text-slate-600 whitespace-pre-wrap">{item.details}</p><button className={button} onClick={()=>setDispute(item)}>Open dispute & evidence</button></article>)}</div>}
      {tab==='Activity'&&<div className="space-y-3">{!profile.activity.length&&<Empty text="No recorded activity for this account yet."/>}{profile.activity.map(item=><article key={item.id} className={panel}><h2 className="text-xs font-bold text-slate-900">{item.action.replaceAll('_',' ')}</h2><p className="text-xs text-slate-500">{item.actorName} · {date(item.timestamp)}</p><p className="text-xs text-slate-700 break-words">{item.changesSummary}</p></article>)}</div>}
    </>}
  </div>;
}
function Empty({text}:{text:string}){return <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{text}</p>;}
