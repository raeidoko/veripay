/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SellerProfile, Transaction, TransactionStatus } from '../types';
import { SEED_SELLERS } from '../seedData';
import VeriPayLogo from './VeriPayLogo';
import { ShieldCheck, Truck, Clock, AlertTriangle, CheckCircle, Smartphone, HelpCircle, ArrowRight, CornerDownRight, Landmark } from 'lucide-react';

interface EscrowWizardProps {
  selectedSeller: SellerProfile | null;
  activeTransaction: Transaction | null;
  onClearSelectedSeller: () => void;
  onCreateTransaction: (txData: Partial<Transaction>) => void;
  onPayEscrow: (txId: string) => void;
  onConfirmDelivery: (txId: string) => void;
  onTriggerDispute: (txId: string, reason: string, description: string) => void;
}

export default function EscrowWizard({
  selectedSeller,
  activeTransaction,
  onClearSelectedSeller,
  onCreateTransaction,
  onPayEscrow,
  onConfirmDelivery,
  onTriggerDispute,
}: EscrowWizardProps) {
  // Creation Form State
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Fashion & Apparel');
  const [amount, setAmount] = useState<number>(0);
  const [deliveryPartner, setDeliveryPartner] = useState('GIG Logistics');
  const [deliveryTimelineDays, setDeliveryTimelineDays] = useState(3);
  const [terms, setTerms] = useState('');
  const [buyerName, setBuyerName] = useState('Femi Adebayo');
  const [buyerPhone, setBuyerPhone] = useState('+234 802 888 7766');

  // Checkout PIN State
  const [showCheckout, setShowCheckout] = useState(false);
  const [pin, setPin] = useState('');

  // Dispute Filing State
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('Wrong Product / Damaged Item');
  const [disputeDesc, setDisputeDesc] = useState('');

  // Populate from selected seller if available
  React.useEffect(() => {
    if (selectedSeller) {
      setCategory(selectedSeller.category);
    }
  }, [selectedSeller]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || amount <= 0 || !terms.trim()) return;

    const seller = selectedSeller || SEED_SELLERS[0];

    onCreateTransaction({
      productName,
      category,
      amount,
      sellerId: seller.id,
      sellerName: seller.name,
      sellerHandle: seller.handle,
      sellerPhone: seller.phone,
      buyerName,
      buyerPhone,
      deliveryPartner,
      deliveryTimelineDays,
      terms,
    });

    onClearSelectedSeller();
    // Clear creation form
    setProductName('');
    setAmount(0);
    setTerms('');
  };

  const handlePaySubmit = () => {
    if (pin.length < 4 || !activeTransaction) return;
    onPayEscrow(activeTransaction.id);
    setShowCheckout(false);
    setPin('');
  };

  const handleOpenDisputeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeDesc.trim() || !activeTransaction) return;
    onTriggerDispute(activeTransaction.id, disputeReason, disputeDesc);
    setShowDisputeForm(false);
    setDisputeDesc('');
  };

  const getStepIndex = (status: TransactionStatus) => {
    switch (status) {
      case 'DRAFT': return 0;
      case 'PENDING_PAYMENT': return 1;
      case 'PAYMENT_SECURED': return 2;
      case 'DISPATCHED': return 3;
      case 'IN_TRANSIT': return 4;
      case 'DELIVERED': return 5;
      case 'COMPLETED': return 6;
      case 'DISPUTED': return 6;
      case 'REFUNDED': return 6;
      default: return 0;
    }
  };

  // UI Helper for map tracking coordinates & animations
  const getDeliveryMapPosition = (status: TransactionStatus) => {
    switch (status) {
      case 'DISPATCHED': return '12%';
      case 'IN_TRANSIT': return '50%';
      case 'DELIVERED': return '100%';
      default: return '0%';
    }
  };

  return (
    <div id="escrow-wizard" className="space-y-6">
      
      {/* 1. SELLER SELECTION & AGREEMENT CREATION FORM */}
      {selectedSeller && !activeTransaction && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-4">
            <div>
              <span className="text-[10px] bg-[#2563EB]/10 text-[#2563EB] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider block mb-1">Step 1: Create Agreement</span>
              <h3 className="font-sans font-bold text-slate-800 text-lg">New Escrow with {selectedSeller.name}</h3>
            </div>
            <button onClick={onClearSelectedSeller} className="text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vintage Leather Jacket, iPhone 11 Pro"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase">Agreed Amount (NGN)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="NGN Price"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:outline-none font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase">Delivery Logistics Partner</label>
                <select
                  value={deliveryPartner}
                  onChange={(e) => setDeliveryPartner(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                >
                  <option>GIG Logistics</option>
                  <option>DHL Express</option>
                  <option>Fez Delivery</option>
                  <option>Gokada Express</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase">Delivery Windows (Days)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="14"
                  value={deliveryTimelineDays}
                  onChange={(e) => setDeliveryTimelineDays(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase">Custom Terms & Inspection Conditions</label>
              <textarea
                required
                rows={3}
                placeholder="Be extremely specific! (e.g. Size L, must include unboxing checks, no tears, standard testing window of 24 hours after arrival)"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
              />
            </div>

            <div className="bg-slate-50 rounded-xl p-3 flex gap-2 border border-slate-100 items-start">
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-500 leading-relaxed">
                <span className="font-bold text-slate-700 block mb-0.5">VeriPay Security Pledge</span>
                Once created, the buyer deposits funds. VeriPay secures this money. The merchant dispatches. Funds are only transferred to the merchant when the buyer confirms delivery, or automatically after {deliveryTimelineDays} days if no dispute is opened.
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              Draft & Request Payment <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* 2. ACTIVE ESCROW WORKFLOW VIEW */}
      {activeTransaction && (
        <div className="space-y-6">
          
          {/* Progress Timeline Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Agreement Pipeline</span>
            <h3 className="text-base font-bold text-slate-800 mb-6">{activeTransaction.productName}</h3>

            {/* Stepper Graphic */}
            <div className="relative flex justify-between items-center w-full">
              {/* Timeline Connector Line */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 z-0">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(getStepIndex(activeTransaction.status) / 6) * 100}%` }}
                />
              </div>

              {/* Step Bubbles */}
              {['Draft', 'Secure', 'Ship', 'Transit', 'Delivery', 'Release'].map((step, idx) => {
                const currentIdx = getStepIndex(activeTransaction.status);
                const isCompleted = idx < currentIdx;
                const isActive = idx === currentIdx;

                return (
                  <div key={step} className="flex flex-col items-center z-10 text-center relative">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        isCompleted
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : isActive
                          ? 'bg-[#2563EB] text-white ring-4 ring-blue-100'
                          : 'bg-white text-slate-400 border-2 border-slate-200'
                      }`}
                    >
                      {isCompleted ? 'Done' : idx + 1}
                    </div>
                    <span className={`text-[10px] font-bold mt-2 uppercase tracking-wider ${isActive ? 'text-[#2563EB]' : 'text-slate-400'}`}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ACTIVE STEP CARD: PENDING_PAYMENT */}
          {activeTransaction.status === 'PENDING_PAYMENT' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">
                    <Clock className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="font-sans font-bold text-slate-800">Awaiting Escrow Deposit</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Please deposit funds to activate this secure agreement.</p>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-2 text-xs">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-500">Agreed Price</span>
                    <span className="text-slate-800 font-bold">NGN {activeTransaction.amount.toLocaleString('en-NG')}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-500">OPay Escrow Admin Fee (1.5%)</span>
                    <span className="text-slate-800 font-bold">NGN {(activeTransaction.amount * 0.015).toLocaleString('en-NG')}</span>
                  </div>
                  <div className="flex justify-between font-black text-[#0F172A] text-sm border-t border-slate-200 pt-2">
                    <span>Deposit Total</span>
                    <span>NGN {(activeTransaction.amount * 1.015).toLocaleString('en-NG')}</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowCheckout(true)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  Securely Pay with OPay Wallet
                </button>
              </div>

              {/* QR code payment block */}
              <div className="w-full md:w-56 border border-slate-200 rounded-2xl p-4 bg-slate-50/60 flex flex-col items-center text-center">
                <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider mb-2">Order Pay QR</span>
                <div className="w-32 h-32 bg-white rounded-lg p-2 border border-slate-200 flex items-center justify-center relative">
                    {/* Generated payment QR code */}
                  <svg viewBox="0 0 100 100" className="w-full h-full text-[#0F172A]">
                    <rect x="0" y="0" width="100" height="100" fill="white" />
                    {/* QR Finder patterns */}
                    <rect x="5" y="5" width="25" height="25" fill="currentColor" />
                    <rect x="10" y="10" width="15" height="15" fill="white" />
                    <rect x="12" y="12" width="11" height="11" fill="currentColor" />
                    
                    <rect x="70" y="5" width="25" height="25" fill="currentColor" />
                    <rect x="75" y="10" width="15" height="15" fill="white" />
                    <rect x="77" y="12" width="11" height="11" fill="currentColor" />
                    
                    <rect x="5" y="70" width="25" height="25" fill="currentColor" />
                    <rect x="10" y="75" width="15" height="15" fill="white" />
                    <rect x="12" y="77" width="11" height="11" fill="currentColor" />
                    {/* Random noise bits */}
                    <rect x="40" y="10" width="8" height="8" fill="currentColor" />
                    <rect x="50" y="25" width="12" height="6" fill="currentColor" />
                    <rect x="35" y="45" width="30" height="10" fill="currentColor" />
                    <rect x="70" y="45" width="10" height="15" fill="currentColor" />
                    <rect x="45" y="70" width="15" height="15" fill="currentColor" />
                    {/* Centered OPay miniature logo */}
                    <rect x="42" y="42" width="16" height="16" fill="white" rx="2" />
                    <circle cx="50" cy="50" r="5" fill="#2563EB" />
                  </svg>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                  Scan to pay instantly via your OPay phone application.
                </p>
              </div>
            </div>
          )}

          {/* ACTIVE STEP CARD: LOGISTICS TRANSIT MAP VIEW */}
          {['PAYMENT_SECURED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED'].includes(activeTransaction.status) && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                    <Truck className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="font-sans font-bold text-slate-800">Logistics & Escrow Holding Status</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Tracking code: <span className="font-mono font-bold text-[#2563EB]">{activeTransaction.trackingNumber || 'LOCAL-DELIVERY'}</span></p>
                  </div>
                </div>

                {/* Buyer Actions on Delivery */}
                {activeTransaction.status === 'DELIVERED' && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => onConfirmDelivery(activeTransaction.id)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                    >
                      Release Funds to Seller
                    </button>
                    <button
                      onClick={() => setShowDisputeForm(true)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                    >
                      File Dispute
                    </button>
                  </div>
                )}
              </div>

              {/* Visual Route Tracking Map (Custom SVG) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 overflow-hidden relative">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-4">Lagos Shipping Waypoint Map</span>
                
                {/* SVG Route Line */}
                <div className="relative h-24 flex items-center justify-between px-10">
                  {/* Route Pathway Line */}
                  <div className="absolute left-16 right-16 top-1/2 -translate-y-1/2 h-1 bg-slate-200 border-dashed z-0">
                    <div
                      className="h-full bg-purple-600 transition-all duration-700"
                      style={{ width: getDeliveryMapPosition(activeTransaction.status) }}
                    />
                  </div>

                  {/* Animated rider icon moving along the path */}
                  {['DISPATCHED', 'IN_TRANSIT'].includes(activeTransaction.status) && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 transition-all duration-700 flex flex-col items-center"
                      style={{ left: `calc(4rem + (100% - 8rem) * ${activeTransaction.status === 'DISPATCHED' ? 0.15 : 0.5})` }}
                    >
                      <div className="bg-purple-600 text-white p-1.5 rounded-full shadow-lg animate-bounce">
                        <Truck className="w-4 h-4" />
                      </div>
                      <span className="text-[8px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-bold uppercase mt-1 tracking-wider whitespace-nowrap">Rider Kazeem</span>
                    </div>
                  )}

                  {/* Milestones */}
                  {[
                    { label: 'Seller Hub', loc: 'Lagos Mainland' },
                    { label: 'Transit', loc: 'Third Mainland' },
                    { label: 'Delivery Hub', loc: 'Lekki Station' },
                    { label: 'Destination', loc: 'Buyer Doorstep' },
                  ].map((pt, i) => {
                    const isActive = 
                      (i === 0 && activeTransaction.status === 'PAYMENT_SECURED') ||
                      (i === 1 && activeTransaction.status === 'DISPATCHED') ||
                      (i === 2 && activeTransaction.status === 'IN_TRANSIT') ||
                      (i === 3 && activeTransaction.status === 'DELIVERED');

                    const isPassed = 
                      (i === 0 && ['DISPATCHED', 'IN_TRANSIT', 'DELIVERED'].includes(activeTransaction.status)) ||
                      (i === 1 && ['IN_TRANSIT', 'DELIVERED'].includes(activeTransaction.status)) ||
                      (i === 2 && ['DELIVERED'].includes(activeTransaction.status));

                    return (
                      <div key={i} className="flex flex-col items-center z-10 text-center relative">
                        <div
                          className={`w-4 h-4 rounded-full transition-all ${
                            isPassed
                              ? 'bg-purple-600 ring-4 ring-purple-100'
                              : isActive
                              ? 'bg-purple-600 ring-4 ring-purple-200 animate-pulse'
                              : 'bg-white border-2 border-slate-300'
                          }`}
                        />
                        <span className="text-[9px] font-bold text-slate-700 mt-2 block leading-none">{pt.label}</span>
                        <span className="text-[8px] text-slate-400 font-medium block mt-1">{pt.loc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Unboxing Checklists (Challenge-Mitigation) */}
              <div className="bg-[#0F172A] text-white rounded-xl p-4 shadow-sm">
                <h5 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#2563EB]" /> Mandatory Safe-Escrow Unboxing Code
                </h5>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  To protect your payout and prevent false claims, we advise taking a continuous unboxing video from the moment you cut the shipping seal. 
                </p>
                <div className="space-y-1.5 text-[11px] text-slate-300 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500">OK</span> <span>Check that the shipping airway bill matches your name</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500">OK</span> <span>Begin recording video before breaking bubble wrap</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500">OK</span> <span>Demonstrate item condition & power-on sequence</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE STEP CARD: COMPLETED, DISPUTED, REFUNDED */}
          {['COMPLETED', 'DISPUTED', 'REFUNDED'].includes(activeTransaction.status) && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-sans font-bold text-slate-800 text-lg">Transaction Finalized</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                  This transaction has moved out of active holding. The funds have been permanently settled according to the terms of service.
                </p>
              </div>
              <div className="inline-flex gap-2">
                <span className="px-3 py-1 bg-slate-50 text-slate-600 border border-slate-200 text-xs font-bold rounded-lg uppercase">
                  {activeTransaction.status}
                </span>
              </div>
            </div>
          )}

        </div>
      )}

      {/* 3. OPAY WALLET CHECKOUT MODAL */}
      {showCheckout && activeTransaction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 font-sans">
            {/* OPay Stylized Header */}
            <div className="bg-emerald-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-white/10 text-white rounded-lg">
                  <Landmark className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-sans font-extrabold text-sm leading-none">OPay Wallet Checkout</h3>
                  <span className="text-[10px] text-emerald-100 font-medium block mt-0.5">VERIPAY INTEGRATED ESCROW</span>
                </div>
              </div>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-white/80 hover:text-white text-xs cursor-pointer font-bold"
              >
                Cancel
              </button>
            </div>

            {/* Core checkout details */}
            <div className="p-6 space-y-5">
              <div className="text-center">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Funding Total</span>
                <span className="text-3xl font-black text-slate-800 mt-1 block">
                  NGN {(activeTransaction.amount * 1.015).toLocaleString('en-NG')}
                </span>
                <span className="text-[10px] text-slate-400 font-medium block mt-1">Escrow Admin fee included</span>
              </div>

              <div className="space-y-3 bg-slate-50 border border-slate-100 p-4 rounded-xl text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Order Target</span>
                  <span className="font-semibold text-slate-800">{activeTransaction.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient Merchant</span>
                  <span className="font-semibold text-[#2563EB]">{activeTransaction.sellerHandle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Holding Authority</span>
                  <span className="font-bold text-emerald-700">VeriPay Escrow Vault</span>
                </div>
              </div>

              {/* PIN pad input */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 block text-center uppercase">Enter OPay 4-Digit Wallet PIN</label>
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-black transition-all ${
                        pin.length > idx
                          ? 'border-emerald-600 bg-emerald-50/50 text-slate-800'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      {pin.length > idx ? '*' : ''}
                    </div>
                  ))}
                </div>

                {/* Numeric click targets */}
                <div className="grid grid-cols-3 gap-2.5 max-w-[200px] mx-auto pt-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => pin.length < 4 && setPin(prev => prev + val)}
                      className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/80 font-bold text-slate-700 flex items-center justify-center transition-all cursor-pointer text-sm"
                    >
                      {val}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPin('')}
                    className="w-10 h-10 rounded-full bg-rose-50 hover:bg-rose-100 font-bold text-rose-600 flex items-center justify-center transition-all cursor-pointer text-[10px] uppercase"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => pin.length < 4 && setPin(prev => prev + '0')}
                    className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/80 font-bold text-slate-700 flex items-center justify-center transition-all cursor-pointer text-sm"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={pin.length < 4}
                    onClick={handlePaySubmit}
                    className={`w-10 h-10 rounded-full font-bold flex items-center justify-center transition-all cursor-pointer text-[10px] uppercase ${
                      pin.length === 4
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Pay
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. DISPUTE FILING OVERLAY FORM */}
      {showDisputeForm && activeTransaction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 font-sans p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <h3 className="font-bold text-slate-800 text-base">File Escrow Dispute</h3>
              <button onClick={() => setShowDisputeForm(false)} className="text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                Cancel
              </button>
            </div>

            <form onSubmit={handleOpenDisputeSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase">Primary Dispute Reason</label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB]"
                >
                  <option>Wrong Product / Damaged Item</option>
                  <option>Item Never Arrived / No Delivery Code</option>
                  <option>Counterfeit or Replica Goods</option>
                  <option>Missing Accessories/Parts</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase">Provide Thorough Details</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe exactly what is wrong with the product or package. The OPay escrow audit team will review your unboxing checklist video."
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="bg-rose-50 border border-rose-100/50 p-3 rounded-xl flex gap-2 items-start text-xs text-rose-700 leading-relaxed">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">Dispute Penalty Warning</span>
                  Filing fraudulent or false disputes without uploading unboxing evidence may result in a decrease of your trust ratings or temporary suspension of your OPay digital wallet benefits.
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-xl transition-all cursor-pointer shadow-sm"
              >
                File Formal Claim
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
