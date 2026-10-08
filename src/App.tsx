/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthUser, Transaction, SellerProfile, Notification } from './types';
import { SEED_TRANSACTIONS, SEED_SELLERS } from './seedData';
import {
  clearNotifications,
  clearAuthToken,
  confirmDelivery,
  createQrTransaction,
  createTransaction,
  fileDispute,
  getAuthToken,
  loadCurrentUser,
  loadVeriPayState,
  login,
  markNotificationRead,
  payEscrow,
  resolveDispute,
  setAuthToken,
  VeriPayState,
} from './api';
import VeriPayLogo from './components/VeriPayLogo';
import SellerDirectory from './components/SellerDirectory';
import DisputeCenter from './components/DisputeCenter';
import EscrowWizard from './components/EscrowWizard';
import DigitalReceipt from './components/DigitalReceipt';
import NotificationsPanel from './components/NotificationsPanel';
import LoginPanel from './components/LoginPanel';
import { Activity, CheckCircle, ChevronRight, LogOut, Pencil, Receipt, Scale, Store, Wallet } from 'lucide-react';

const formatNaira = (amount: number) => `NGN ${amount.toLocaleString('en-NG')}`;

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
  const [transactions, setTransactions] = useState<Transaction[]>(SEED_TRANSACTIONS);

  const [activeTxId, setActiveTxId] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [selectedSeller, setSelectedSeller] = useState<SellerProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'history' | 'sellers' | 'disputes'>('pipeline');
  const [showReceiptTx, setShowReceiptTx] = useState<Transaction | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [apiStatus, setApiStatus] = useState<'connecting' | 'connected' | 'offline' | 'saving'>('connecting');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const applyServerState = (state: VeriPayState) => {
    const loadedTransactions = state.transactions.length ? state.transactions : SEED_TRANSACTIONS;
    setTransactions(loadedTransactions);
    setNotifications(state.notifications || []);
    return loadedTransactions;
  };

  const runServerAction = async (action: () => Promise<VeriPayState>) => {
    setApiStatus('saving');
    try {
      const state = await action();
      const loadedTransactions = applyServerState(state);
      setApiStatus('connected');
      return loadedTransactions;
    } catch (error) {
      setApiStatus('offline');
      throw error;
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!getAuthToken()) {
      setAuthChecked(true);
      return;
    }

    loadCurrentUser()
      .then(({ user }) => {
        if (!cancelled) setAuthUser(user);
      })
      .catch(() => {
        clearAuthToken();
        if (!cancelled) setAuthUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate from the VeriPay API so transaction state is shared outside this browser.
  useEffect(() => {
    if (!authUser) return;

    let cancelled = false;

    loadVeriPayState()
      .then((state) => {
        if (cancelled) return;
        const loadedTransactions = applyServerState(state);
        const active = loadedTransactions.find(t => !['COMPLETED', 'REFUNDED'].includes(t.status));
        setActiveTxId(active ? active.id : loadedTransactions[0]?.id || null);
        setApiStatus('connected');
      })
      .catch(() => {
        if (cancelled) return;
        const active = SEED_TRANSACTIONS.find(t => !['COMPLETED', 'REFUNDED'].includes(t.status));
        setActiveTxId(active ? active.id : SEED_TRANSACTIONS[0]?.id || null);
        setApiStatus('offline');
      })
      .finally(() => {
        if (!cancelled) setIsHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const handleLogin = async (phone: string, password: string) => {
    const result = await login(phone, password);
    setAuthToken(result.token);
    setAuthUser(result.user);
    setApiStatus('connecting');
    setIsHydrated(false);
  };

  const handleLogout = () => {
    clearAuthToken();
    setAuthUser(null);
    setTransactions(SEED_TRANSACTIONS);
    setNotifications([]);
    setActiveTxId(null);
    setIsHydrated(false);
    setAuthChecked(true);
  };

  // Derived Values
  const activeTransaction = transactions.find(t => t.id === activeTxId) || null;
  const disputedTransactions = transactions.filter(t => t.status === 'DISPUTED');

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
  const handleScanSellerQR = async (seller: SellerProfile) => {
    playSound('success');
    const loadedTransactions = await runServerAction(() => createQrTransaction(seller.id));
    setActiveTxId(loadedTransactions[0]?.id || null);
    setActiveTab('pipeline');
  };

  // Handler: Draft/Create new transaction
  const handleCreateTransaction = async (txData: Partial<Transaction>) => {
    const loadedTransactions = await runServerAction(() => createTransaction(txData));
    setActiveTxId(loadedTransactions[0]?.id || null);
    playSound('alert');
  };

  // Handler: Secure payment deposit
  const handlePayEscrow = async (txId: string) => {
    await runServerAction(() => payEscrow(txId));
    playSound('success');
  };

  const handleConfirmDelivery = async (txId: string) => {
    const loadedTransactions = await runServerAction(() => confirmDelivery(txId));
    playSound('success');
    const completedItem = loadedTransactions.find(x => x.id === txId);
    if (completedItem) {
      setTimeout(() => setShowReceiptTx(completedItem), 1200);
    }
  };

  // Handler: Open dispute claim from modal
  const handleTriggerDispute = async (txId: string, reason: string, description: string) => {
    await runServerAction(() => fileDispute(txId, reason, description));
    playSound('alert');
    setActiveTab('disputes');
  };

  // Handler: Admin arbitration decisions
  const handleResolveDispute = async (txId: string, verdict: 'BUYER_REFUNDED' | 'SELLER_PAID') => {
    await runServerAction(() => resolveDispute(txId, verdict));
    playSound('success');
  };

  // Notification actions
  const handleMarkRead = async (id: string) => {
    await runServerAction(() => markNotificationRead(id));
  };

  const handleClearNotifications = async () => {
    await runServerAction(() => clearNotifications());
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center text-sm font-bold text-slate-500">
        Checking secure session...
      </div>
    );
  }

  if (!authUser) {
    return <LoginPanel onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col justify-between">
      
      {/* 1. PROFESSIONAL APP HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo & Slogan */}
          <VeriPayLogo size="md" showSubtitle={true} />

          {/* Overall Platform Metrics */}
          <div className="flex gap-3 text-xs">
            <div className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 text-center shadow-sm hidden sm:block">
              <span className="text-[#64748B] block mb-0.5 font-semibold uppercase tracking-wider text-[9px]">{authUser.role}</span>
              <span className="font-bold text-[#0F172A] text-sm">{authUser.name}</span>
            </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 text-center shadow-sm">
              <span className="text-[#64748B] block mb-0.5 font-semibold uppercase tracking-wider text-[9px]">Escrow Vault Secured</span>
              <span className="font-bold text-[#0F172A] text-sm">{formatNaira(transactions.filter(t => !['COMPLETED', 'REFUNDED'].includes(t.status)).reduce((sum, tx) => sum + tx.amount, 0))}</span>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 text-center shadow-sm">
              <span className="text-[#64748B] block mb-0.5 font-semibold uppercase tracking-wider text-[9px]">Protection rate</span>
              <span className="font-bold text-emerald-600 text-sm flex items-center justify-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> 100% Secure
              </span>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 text-center shadow-sm">
              <span className="text-[#64748B] block mb-0.5 font-semibold uppercase tracking-wider text-[9px]">API Status</span>
              <span className={`font-bold text-sm ${apiStatus === 'offline' ? 'text-rose-600' : 'text-[#2563EB]'}`}>
                {apiStatus === 'saving' ? 'Saving' : apiStatus === 'connected' ? 'Live' : apiStatus === 'offline' ? 'Offline' : 'Connecting'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white border border-[#E2E8F0] hover:bg-slate-50 rounded-xl px-3 py-2 text-slate-500 hover:text-rose-600 shadow-sm transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
