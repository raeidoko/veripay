/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Transaction, EvidenceFile } from '../types';
import { ShieldAlert, CheckCircle, Clock, FileText, Send, User, ShoppingBag, Landmark, Scale } from 'lucide-react';

interface DisputeCenterProps {
  disputedTransactions: Transaction[];
  onResolveDispute: (transactionId: string, verdict: 'BUYER_REFUNDED' | 'SELLER_PAID') => void;
}

export default function DisputeCenter({
  disputedTransactions,
  onResolveDispute,
}: DisputeCenterProps) {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(
    disputedTransactions.length > 0 ? disputedTransactions[0] : null
  );
  const [chatMessage, setChatMessage] = useState('');
  const [localChats, setLocalChats] = useState<{ [key: string]: Array<{ sender: string, text: string, time: string }> }>({
    'VP-11048': [
      { sender: 'BUYER', text: 'I opened the DHL box immediately on camera. The scratch is deep, and definitely pre-existing. I want to return the device.', time: '10:05 AM' },
      { sender: 'SELLER', text: 'We check every item before bubble wrapping. We have packing footage. It might be transit damage or buyer damage.', time: '10:15 AM' },
      { sender: 'OPAY_MEDIATOR', text: 'Arbitrator assigned. Femi, please confirm if the outer bubble wrap was torn. Gadget Hub, please upload your packaging video or check-off slip.', time: '10:30 AM' },
    ]
  });

  // Keep selectedTx up to date with props changes
  React.useEffect(() => {
    if (selectedTx) {
      const updated = disputedTransactions.find(t => t.id === selectedTx.id);
      if (updated) {
        setSelectedTx(updated);
      }
    } else if (disputedTransactions.length > 0) {
      setSelectedTx(disputedTransactions[0]);
    }
  }, [disputedTransactions]);

  const handleSendChat = () => {
    if (!chatMessage.trim() || !selectedTx) return;
    
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const newChat = { sender: 'BUYER', text: chatMessage, time };
    
    setLocalChats(prev => ({
      ...prev,
      [selectedTx.id]: [...(prev[selectedTx.id] || []), newChat]
    }));
    
    setChatMessage('');

    // Add a mediator response after the buyer submits a case message.
    setTimeout(() => {
      const systemReply = {
        sender: 'OPAY_MEDIATOR',
        text: 'Thank you for updating. Your additional comment has been logged for case analysis. A final decision will be reached shortly.',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      };
      setLocalChats(prev => ({
        ...prev,
        [selectedTx.id]: [...(prev[selectedTx.id] || []), systemReply]
      }));
    }, 2000);
  };

  const getArbitrationStatusLabel = (status: 'PENDING' | 'UNDER_REVIEW' | 'BUYER_REFUNDED' | 'SELLER_PAID') => {
    switch (status) {
      case 'PENDING': return 'Awaiting Claims';
      case 'UNDER_REVIEW': return 'Under OPay Dispute Review';
      case 'BUYER_REFUNDED': return 'Refunded to Buyer';
      case 'SELLER_PAID': return 'Payout Awarded to Seller';
    }
  };

  return (
    <div id="dispute-center" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden font-sans">
      <div className="bg-[#0F172A] text-white p-6">
        <div className="flex items-center gap-3">
          <Scale className="w-8 h-8 text-[#2563EB]" />
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">VeriPay Dispute & Arbitration Center</h2>
            <p className="text-xs text-slate-400 mt-1">
              Independent, secure dispute resolution. OPay holds disputed funds safely until cases are resolved.
            </p>
          </div>
        </div>
      </div>

      {disputedTransactions.length === 0 ? (
        <div className="text-center py-16 px-4">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-lg">Your Account is in Great Standing</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            You do not have any active transaction disputes. VeriPay escrow keeps commerce safe and friction-free!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
          {/* Left: Dispute List */}
          <div className="lg:col-span-4 border-r border-slate-100 bg-slate-50/50 p-4 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Active Dispute Claims</span>
            <div className="space-y-2">
              {disputedTransactions.map((tx) => (
                <button
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col ${
                    selectedTx?.id === tx.id
                      ? 'bg-white border-[#2563EB] shadow-sm ring-1 ring-[#2563EB]/10'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs font-bold text-slate-500">{tx.id}</span>
                    <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded uppercase">
                      {tx.dispute?.reason || 'Disputed'}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm mt-1.5 truncate">{tx.productName}</h4>
                  <span className="text-xs text-slate-400 mt-1">Merchant: {tx.sellerName}</span>
                  <div className="flex justify-between items-center mt-3 border-t border-slate-100 pt-2.5">
                    <span className="text-xs font-extrabold text-[#0F172A]">NGN {tx.amount.toLocaleString('en-NG')}</span>
                    <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Under Review
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Selected Dispute Details */}
          {selectedTx && selectedTx.dispute && (
            <div className="lg:col-span-8 p-6 flex flex-col h-full justify-between">
              <div className="space-y-6">
                {/* Status banner */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Arbitration Status</span>
                    <span className="font-bold text-slate-800 text-sm">{getArbitrationStatusLabel(selectedTx.dispute.arbitrationStatus)}</span>
                  </div>
                  {/* Arbitrator decision actions */}
                  {selectedTx.dispute.arbitrationStatus === 'UNDER_REVIEW' && (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => onResolveDispute(selectedTx.id, 'BUYER_REFUNDED')}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Refund Buyer
                      </button>
                      <button
                        onClick={() => onResolveDispute(selectedTx.id, 'SELLER_PAID')}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Payout Seller
                      </button>
                    </div>
                  )}
                </div>

                {/* Dispute Overview details */}
                <div className="space-y-2">
                  <h3 className="font-sans font-bold text-slate-800 text-lg leading-snug">
                    {selectedTx.dispute.reason}
                  </h3>
                  <p className="text-xs text-slate-400">Filed on {new Date(selectedTx.dispute.createdAt).toLocaleString('en-NG')}</p>
                  <p className="text-sm text-slate-600 bg-rose-50/20 border border-rose-100/50 rounded-xl p-4 leading-relaxed mt-2 italic">
                    &ldquo;{selectedTx.dispute.description}&rdquo;
                  </p>
                </div>

                {/* Evidence Attachments */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Evidence Filed</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Buyer Evidence */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full uppercase">Buyer Proof</span>
                      <div className="mt-2 space-y-2">
                        {selectedTx.dispute.buyerEvidence.map((ev) => (
                          <div key={ev.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100">
                            <img src={ev.url} alt={ev.name} className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                            <div className="text-xs overflow-hidden">
                              <span className="font-bold text-slate-700 block truncate">{ev.name}</span>
                              <span className="text-[10px] text-slate-400">Attached Photo</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Seller Evidence */}
                    <div className="border border-[#E2E8F0] rounded-xl p-3 bg-slate-50/50">
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full uppercase">Seller Counter-Proof</span>
                      <div className="mt-2 space-y-2">
                        {selectedTx.dispute.sellerEvidence.length > 0 ? (
                          selectedTx.dispute.sellerEvidence.map((ev) => (
                            <div key={ev.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100">
                              <img src={ev.url} alt={ev.name} className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                              <div className="text-xs overflow-hidden">
                                <span className="font-bold text-slate-700 block truncate">{ev.name}</span>
                                <span className="text-[10px] text-slate-400">Attached Photo</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 bg-white rounded-lg border border-slate-100 text-[11px] text-slate-400 italic">
                            No seller evidence submitted yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dispute Dialogue/Chat Log */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">OPay Mediated Discussion</span>
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3 max-h-[180px] overflow-y-auto">
                    {(localChats[selectedTx.id] || []).map((chat, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-2.5 max-w-[85%] ${
                          chat.sender === 'BUYER' ? 'ml-auto flex-row-reverse' : ''
                        }`}
                      >
                        {/* Avatar */}
                        <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                          chat.sender === 'BUYER' ? 'bg-[#2563EB] text-white' : 
                          chat.sender === 'SELLER' ? 'bg-[#0F172A] text-white' : 'bg-slate-800 text-yellow-400'
                        }`}>
                          {chat.sender === 'BUYER' ? <User className="w-3 h-3" /> : 
                           chat.sender === 'SELLER' ? <ShoppingBag className="w-3 h-3" /> : <Landmark className="w-3 h-3" />}
                        </div>

                        {/* Message bubble */}
                        <div className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                          chat.sender === 'BUYER' ? 'bg-[#2563EB] text-white rounded-tr-none' :
                          chat.sender === 'SELLER' ? 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200' :
                          'bg-yellow-50 text-slate-800 rounded-tl-none border border-yellow-200 font-medium'
                        }`}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[9px] font-bold tracking-wider uppercase opacity-85">
                              {chat.sender === 'OPAY_MEDIATOR' ? 'OPAY ARBITRATOR' : chat.sender}
                            </span>
                            <span className="text-[8px] opacity-60 font-mono">{chat.time}</span>
                          </div>
                          <p>{chat.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chat Input */}
                  {selectedTx.dispute.arbitrationStatus === 'UNDER_REVIEW' && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="State your claim to the arbitrator..."
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                        className="flex-1 px-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
                      />
                      <button
                        onClick={handleSendChat}
                        className="p-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl transition-all cursor-pointer shadow-sm"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
