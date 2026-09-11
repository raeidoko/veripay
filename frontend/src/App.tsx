/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Transaction, SellerProfile, Notification, TimelineEvent } from './types';
import { SEED_TRANSACTIONS, SEED_SELLERS } from './seedData';
import VeriPayLogo from './components/VeriPayLogo';
import SellerDirectory from './components/SellerDirectory';
import DisputeCenter from './components/DisputeCenter';
import EscrowWizard from './components/EscrowWizard';
import DigitalReceipt from './components/DigitalReceipt';
import NotificationsPanel from './components/NotificationsPanel';
import { Activity, CheckCircle, ChevronRight, Pencil, Receipt, Scale, Store, Wallet } from 'lucide-react';

const formatNaira = (amount: number) => `NGN ${amount.toLocaleString('en-NG')}`;

function readStoredList<T>(key: string, fallback: T[]): T[] {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

// Web Audio API synthesizer for click and event sound effects.
function playSound(type: 'success' | 'alert' | 'click') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'success') {
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.36); // C6
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'alert') {
      const now = ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(587.33, now + 0.15); // D5
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'click') {
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (e) {
    // Benign, browser audio policies might block autoplay
  }
}

export default function App() {
  // State Initialization
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    return readStoredList('veripay_transactions', SEED_TRANSACTIONS);
  });

  const [activeTxId, setActiveTxId] = useState<string | null>(() => {
    // Try to find the first incomplete/active transaction on startup
    const list = readStoredList<Transaction>('veripay_transactions', SEED_TRANSACTIONS);
    const active = list.find(t => !['COMPLETED', 'REFUNDED'].includes(t.status));
    return active ? active.id : list[0]?.id || null;
  });

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = readStoredList<Notification>('veripay_notifications', []);
    if (saved.length > 0) return saved;
    return [
      {
        id: 'n-initial-1',
        transactionId: 'VP-10924',
        title: 'Payout Disbursed Successfully',
        message: 'OPay released NGN 45,000 securely to Prestige Kicks wallet for high-top sneakers.',
        type: 'success',
        timestamp: 'July 1, 2:45 PM',
        read: true,
      },
      {
        id: 'n-initial-2',
        transactionId: 'VP-11048',
        title: 'Dispute Under Arbitration Review',
        message: 'The unboxing video submitted by Femi Adebayo for iPad Air is currently being audited.',
        type: 'warning',
        timestamp: 'July 2, 10:00 AM',
        read: false,
      }
    ];
  });

  const [selectedSeller, setSelectedSeller] = useState<SellerProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'history' | 'sellers' | 'disputes'>('pipeline');
  const [showReceiptTx, setShowReceiptTx] = useState<Transaction | null>(null);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('veripay_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('veripay_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Derived Values
  const activeTransaction = transactions.find(t => t.id === activeTxId) || null;
  const disputedTransactions = transactions.filter(t => t.status === 'DISPUTED');

  // Trigger system notification helper
  const triggerNotification = (txId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => {
    const time = new Date().toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }) + `, ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    const newNotif: Notification = {
      id: `n-${Date.now()}`,
      transactionId: txId,
      title,
      message,
      type,
      timestamp: time,
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
    playSound(type === 'success' ? 'success' : 'alert');
  };

  // Switch tabs cleanly
  const handleTabChange = (tab: 'pipeline' | 'history' | 'sellers' | 'disputes') => {
    playSound('click');
    setActiveTab(tab);
  };

  // Handler: Start new escrow from Seller Directory
  const handleSelectSeller = (seller: SellerProfile) => {
    playSound('click');
    setSelectedSeller(seller);
    setActiveTxId(null);
    setActiveTab('pipeline');
  };

  // Handler: Quick QR checkouts pre-fills and creates transaction
  const handleScanSellerQR = (seller: SellerProfile) => {
    playSound('success');
    const randomProduct = seller.id === 's-1' ? 'Luxury Fitting Ankara' : seller.id === 's-2' ? 'Beats Solo3 Wireless' : 'Vintage Band Bundle';
    const randomAmount = seller.id === 's-1' ? 45000 : seller.id === 's-2' ? 120000 : 15000;
    
    const newTx: Transaction = {
      id: `VP-${Math.floor(10000 + Math.random() * 90000)}`,
      productName: randomProduct,
      category: seller.category,
      amount: randomAmount,
      sellerId: seller.id,
      sellerName: seller.name,
      sellerHandle: seller.handle,
      sellerPhone: seller.phone,
      buyerName: 'Femi Adebayo',
      buyerPhone: '+234 802 888 7766',
      deliveryPartner: 'GIG Logistics',
      trackingNumber: '',
      deliveryTimelineDays: 3,
      terms: `Prefilled scan transaction for ${randomProduct}. Secured via VeriPay.`,
      status: 'PENDING_PAYMENT',
      createdAt: new Date().toISOString(),
      timeline: [
        {
          id: `ev-${Date.now()}`,
          status: 'PENDING_PAYMENT',
          title: 'QR Code Payment Scan',
          description: 'Femi Adebayo scanned merchant QR code to establish this order.',
          timestamp: new Date().toISOString(),
          actor: 'BUYER'
        }
      ]
    };

    setTransactions(prev => [newTx, ...prev]);
    setActiveTxId(newTx.id);
    setActiveTab('pipeline');
    triggerNotification(newTx.id, 'Escrow Established via QR Scan', `Order of ${formatNaira(randomAmount)} initialized. Complete wallet authorization to fund.`, 'info');
  };

  // Handler: Draft/Create new transaction
  const handleCreateTransaction = (txData: Partial<Transaction>) => {
    const newId = `VP-${Math.floor(10000 + Math.random() * 90000)}`;
    const newTx: Transaction = {
      id: newId,
      productName: txData.productName || 'Custom Product',
      category: txData.category || 'General',
      amount: txData.amount || 0,
      sellerId: txData.sellerId || 's-1',
      sellerName: txData.sellerName || 'Merchant',
      sellerHandle: txData.sellerHandle || '@merchant',
      sellerPhone: txData.sellerPhone || '',
      buyerName: txData.buyerName || 'Femi Adebayo',
      buyerPhone: txData.buyerPhone || '',
      deliveryPartner: txData.deliveryPartner || 'GIG Logistics',
      trackingNumber: '',
      deliveryTimelineDays: txData.deliveryTimelineDays || 3,
      terms: txData.terms || 'Inspect on arrival.',
      status: 'PENDING_PAYMENT',
      createdAt: new Date().toISOString(),
      timeline: [
        {
          id: `ev-${Date.now()}`,
          status: 'DRAFT',
          title: 'Escrow Agreement Drafted',
          description: `Agreement drafted by buyer with terms: ${txData.terms}`,
          timestamp: new Date().toISOString(),
          actor: 'BUYER'
        }
      ]
    };

    setTransactions(prev => [newTx, ...prev]);
    setActiveTxId(newId);
    triggerNotification(newId, 'Escrow Order Created', `Agreement established with ${txData.sellerName}. Awaiting payment to hold funds.`, 'info');
  };

  // Handler: Secure payment deposit
  const handlePayEscrow = (txId: string) => {
    setTransactions(prev => prev.map(t => {
      if (t.id === txId) {
        const event: TimelineEvent = {
          id: `ev-${Date.now()}`,
          status: 'PAYMENT_SECURED',
          title: 'Funds Secured in Escrow',
          description: 'OPay successfully secured funds in VeriPay holding vault. Merchant notified.',
          timestamp: new Date().toISOString(),
          actor: 'SYSTEM'
        };
        return {
          ...t,
          status: 'PAYMENT_SECURED',
          timeline: [...t.timeline, event]
        };
      }
      return t;
    }));
    triggerNotification(txId, 'Payment Deposited into Escrow', 'OPay secured full payment in escrow vault. Merchant can now ship safely.', 'success');
  };

  const handleConfirmDelivery = (txId: string) => {
    setTransactions(prev => prev.map(t => {
      if (t.id === txId) {
        const event: TimelineEvent = {
          id: `ev-${Date.now()}`,
          status: 'COMPLETED',
          title: 'Verification Complete - Funds Released',
          description: 'Buyer confirmed item matching terms. Escrow closed. Funds transferred to seller wallet.',
          timestamp: new Date().toISOString(),
          actor: 'BUYER'
        };
        return {
          ...t,
          status: 'COMPLETED',
          timeline: [...t.timeline, event]
        };
      }
      return t;
    }));

    const targetTx = transactions.find(t => t.id === txId);
    if (targetTx) {
      triggerNotification(txId, 'Transaction Complete!', `${formatNaira(targetTx.amount)} was successfully credited to ${targetTx.sellerName}.`, 'success');

      setTimeout(() => {
        const latest = readStoredList<Transaction>('veripay_transactions', []);
        const completedItem = latest.find(x => x.id === txId);
        if (completedItem) {
          setShowReceiptTx(completedItem);
        }
      }, 1200);
    }
  };

  // Handler: Open dispute claim from modal
  const handleTriggerDispute = (txId: string, reason: string, description: string) => {
    setTransactions(prev => prev.map(t => {
      if (t.id === txId) {
        const event: TimelineEvent = {
          id: `ev-${Date.now()}`,
          status: 'DISPUTED',
          title: 'Formal Escrow Dispute Filed',
          description: `Dispute opened by buyer. Reason: ${reason}. Case moved to OPay Arbitration.`,
          timestamp: new Date().toISOString(),
          actor: 'BUYER'
        };
        const disputeObj = {
          id: `disp-${txId}`,
          openedBy: 'BUYER' as const,
          reason,
          description,
          buyerEvidence: [
            { id: `ev-b1-${Date.now()}`, type: 'image' as const, name: 'unboxing_damaged_report.jpg', url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&auto=format&fit=crop' }
          ],
          sellerEvidence: [],
          arbitrationStatus: 'UNDER_REVIEW' as const,
          createdAt: new Date().toISOString()
        };
        return {
          ...t,
          status: 'DISPUTED',
          dispute: disputeObj,
          timeline: [...t.timeline, event]
        };
      }
      return t;
    }));
    triggerNotification(txId, 'Arbitration Claim Filed', 'OPay Dispute Mediator has been notified. Disputed funds are locked in holding.', 'error');
    setActiveTab('disputes');
  };

  // Handler: Admin arbitration decisions
  const handleResolveDispute = (txId: string, verdict: 'BUYER_REFUNDED' | 'SELLER_PAID') => {
    setTransactions(prev => prev.map(t => {
      if (t.id === txId && t.dispute) {
        const finalStatus = verdict === 'BUYER_REFUNDED' ? 'REFUNDED' : 'COMPLETED';
        const event: TimelineEvent = {
          id: `ev-${Date.now()}`,
          status: finalStatus as any,
          title: verdict === 'BUYER_REFUNDED' ? 'Arbitrator Ruled - Buyer Refunded' : 'Arbitrator Ruled - Seller Paid',
          description: verdict === 'BUYER_REFUNDED'
            ? 'OPay Arbitration Team closed file. Full escrow deposit value refunded back to buyer OPay wallet.'
            : 'OPay Arbitration Team audited parcel logs. Funds safely disbursed to Merchant wallet balance.',
          timestamp: new Date().toISOString(),
          actor: 'SYSTEM'
        };
        
        return {
          ...t,
          status: finalStatus as any,
          dispute: {
            ...t.dispute,
            arbitrationStatus: verdict,
            verdictDescription: verdict === 'BUYER_REFUNDED'
              ? 'Based on continuous unboxing video evidence of scratch and lack of seller-side check-off lists, the case was resolved in favor of the buyer. Full refund issued.'
              : 'Logistics partner confirmed insurance package safety checks and weight matched packing. Merchant paid out.'
          },
          timeline: [...t.timeline, event]
        };
      }
      return t;
    }));

    if (verdict === 'BUYER_REFUNDED') {
      triggerNotification(txId, 'Arbitrator Verdict - Refunded', 'Claim resolved. Full refund of order value processed to buyer OPay wallet.', 'success');
    } else {
      triggerNotification(txId, 'Arbitrator Verdict - Paid Out', 'Claim resolved. Hold removed. Order value released to merchant wallet.', 'success');
    }
  };

  // Notification actions
  const handleMarkRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col justify-between">
      
      {/* 1. PROFESSIONAL APP HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo & Slogan */}
          <VeriPayLogo size="md" showSubtitle={true} />

          {/* Overall Platform Metrics */}
          <div className="flex gap-3 text-xs">
            <div className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 text-center shadow-sm">
              <span className="text-[#64748B] block mb-0.5 font-semibold uppercase tracking-wider text-[9px]">Escrow Vault Secured</span>
              <span className="font-bold text-[#0F172A] text-sm">NGN 408,500</span>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 text-center shadow-sm">
              <span className="text-[#64748B] block mb-0.5 font-semibold uppercase tracking-wider text-[9px]">Protection rate</span>
              <span className="font-bold text-emerald-600 text-sm flex items-center justify-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> 100% Secure
              </span>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 text-center shadow-sm">
              <span className="text-[#64748B] block mb-0.5 font-semibold uppercase tracking-wider text-[9px]">Active Mediations</span>
              <span className="font-bold text-[#2563EB] text-sm">{disputedTransactions.length} Case</span>
            </div>
          </div>

        </div>
      </header>

      {/* 3. MAIN DASHBOARD HUB */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT CONTAINER: TABS & VIEWS (8 columns) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Nav Tabs */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-1.5 flex gap-1 shadow-sm overflow-x-auto">
              <button
                onClick={() => handleTabChange('pipeline')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'pipeline'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <Activity className="w-3.5 h-3.5 inline mr-1.5" /> Active Escrow Pipeline
              </button>
              <button
                onClick={() => handleTabChange('history')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <Receipt className="w-3.5 h-3.5 inline mr-1.5" /> History & Receipts
              </button>
              <button
                onClick={() => handleTabChange('sellers')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'sellers'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <Store className="w-3.5 h-3.5 inline mr-1.5" /> Verified Sellers
              </button>
              <button
                onClick={() => handleTabChange('disputes')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer relative ${
                  activeTab === 'disputes'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <Scale className="w-3.5 h-3.5 inline mr-1.5" /> Dispute Center
                {disputedTransactions.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-600 rounded-full animate-ping" />
                )}
              </button>
            </div>

            {/* TAB PANELS RENDERING */}
            <div className="transition-all duration-300">
              
              {/* TAB 1: PIPELINE & WIZARD */}
              {activeTab === 'pipeline' && (
                <div className="space-y-6">
                  {selectedSeller && !activeTransaction && (
                    <EscrowWizard
                      selectedSeller={selectedSeller}
                      activeTransaction={null}
                      onClearSelectedSeller={() => setSelectedSeller(null)}
                      onCreateTransaction={handleCreateTransaction}
                      onPayEscrow={handlePayEscrow}
                      onConfirmDelivery={handleConfirmDelivery}
                      onTriggerDispute={handleTriggerDispute}
                    />
                  )}

                  {activeTransaction && (
                    <EscrowWizard
                      selectedSeller={null}
                      activeTransaction={activeTransaction}
                      onClearSelectedSeller={() => {}}
                      onCreateTransaction={handleCreateTransaction}
                      onPayEscrow={handlePayEscrow}
                      onConfirmDelivery={handleConfirmDelivery}
                      onTriggerDispute={handleTriggerDispute}
                    />
                  )}

                  {!selectedSeller && !activeTransaction && (
                    <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
                      <div className="w-14 h-14 bg-[#2563EB]/5 text-[#2563EB] rounded-full flex items-center justify-center mx-auto">
                        <Wallet className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="font-sans font-extrabold text-slate-800 text-base">Start a Protected Transaction</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                          To establish a secure escrow, browse verified local sellers in our directory or create a direct custom draft.
                        </p>
                      </div>
                      <div className="flex gap-2 justify-center pt-2">
                        <button
                          onClick={() => handleTabChange('sellers')}
                          className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          Browse Verified Sellers
                        </button>
                        <button
                          onClick={() => handleSelectSeller(SEED_SELLERS[0])}
                          className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 inline mr-1" /> Start Custom Draft
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TRANSACTION HISTORY */}
              {activeTab === 'history' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Your Transaction Records</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Select any order to track delivery, review status, or continue a transaction.</p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className={`py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${
                          activeTxId === tx.id ? 'bg-slate-50 px-3 rounded-xl border border-dashed border-slate-200/50' : ''
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#2563EB]">{tx.id}</span>
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                              tx.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              tx.status === 'DISPUTED' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                              tx.status === 'PENDING_PAYMENT' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-blue-50 text-blue-700 border-blue-100'
                            }`}>
                              {tx.status.replace('_', ' ')}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm mt-1.5">{tx.productName}</h4>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                            <span>Merchant: <span className="text-slate-600 font-semibold">{tx.sellerName}</span></span>
                            <span>&bull;</span>
                            <span>{new Date(tx.createdAt).toLocaleDateString('en-NG')}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                          <span className="font-sans font-black text-slate-800">
                            {formatNaira(tx.amount)}
                          </span>
                          
                          <div className="flex gap-2">
                            {tx.status === 'COMPLETED' && (
                              <button
                                onClick={() => setShowReceiptTx(tx)}
                                className="px-3 py-1.5 bg-[#2563EB]/10 text-[#2563EB] hover:bg-blue-100 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Receipt className="w-3.5 h-3.5" /> Receipt
                              </button>
                            )}

                            {!['COMPLETED', 'REFUNDED'].includes(tx.status) && (
                              <button
                                onClick={() => {
                                  setActiveTxId(tx.id);
                                  setActiveTab('pipeline');
                                  playSound('success');
                                }}
                                className="px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-0.5 shadow-sm"
                              >
                                Track Order <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: VERIFIED SELLERS */}
              {activeTab === 'sellers' && (
                <SellerDirectory
                  onSelectSeller={handleSelectSeller}
                  onScanSellerQR={handleScanSellerQR}
                />
              )}

              {/* TAB 4: DISPUTES RESOLUTION */}
              {activeTab === 'disputes' && (
                <DisputeCenter
                  disputedTransactions={disputedTransactions}
                  onResolveDispute={handleResolveDispute}
                />
              )}

            </div>
          </div>

          {/* RIGHT CONTAINER: NOTIFICATIONS FEED (4 columns) */}
          <div className="lg:col-span-4">
            <NotificationsPanel
              notifications={notifications}
              onMarkRead={handleMarkRead}
              onClearAll={handleClearNotifications}
            />
          </div>

        </div>
      </main>

      {/* 4. DIGITAL RECEIPT MODAL OVERLAY */}
      {showReceiptTx && (
        <DigitalReceipt
          transaction={showReceiptTx}
          onClose={() => setShowReceiptTx(null)}
        />
      )}

      {/* 5. BRAND FOOTER */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-6 mt-12 text-center text-xs font-mono select-none">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p>(c) 2026 VeriPay Systems Inc. Secured under OPay License #NGA-48293-C.</p>
          <p className="text-slate-500">Secure escrow protocol is operational and aligned with CBN fintech compliance standards.</p>
        </div>
      </footer>

    </div>
  );
}
