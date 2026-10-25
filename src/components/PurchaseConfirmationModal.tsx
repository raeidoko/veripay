import React, { useState, useEffect } from 'react';
import { ShieldCheck, Check, Sparkles, Lock, FileCheck2, ArrowRight } from 'lucide-react';
import { Order, PurchaseSnapshot } from '../shared/types.ts';
import { api } from '../client/api.ts';

interface PurchaseConfirmationModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onConfirmed: (snapshot: PurchaseSnapshot) => void;
}

export const PurchaseConfirmationModal: React.FC<PurchaseConfirmationModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmed,
}) => {
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<{
    headline: string;
    summaryText: string;
    keyCheckpoints: string[];
    escrowNote: string;
  } | null>(null);
  const [buyerAgreed, setBuyerAgreed] = useState(false);

  useEffect(() => {
    if (isOpen && order) {
      setBuyerAgreed(false);
      setLoading(true);
      api
        .getConfirmationPrompt(order.id)
        .then((prompt) => {
          setAiPrompt(prompt);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isOpen, order]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!aiPrompt) return;
    setConfirming(true);
    try {
      const fullConfirmationText = `${aiPrompt.headline}\n${aiPrompt.summaryText}\n${aiPrompt.keyCheckpoints.join('\n')}\n${aiPrompt.escrowNote}`;
      const snapshot = await api.confirmPurchase(order.id, 'YES_CONFIRMED', fullConfirmationText);
      onConfirmed(snapshot);
    } catch (err) {
      console.error(err);
      alert('Failed to seal purchase snapshot');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 text-brand-300 rounded-lg border border-brand-400/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                AI Purchase Confirmation & Evidence Seal
              </h3>
              <p className="text-xs text-slate-300">
                VeriPay Automatic Evidence Architecture (F2) · Order #{order.orderNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-600 font-medium">
                AI Agent analyzing purchase specs, seller credentials and terms...
              </p>
            </div>
          ) : (
            <>
              {/* Primary AI Question */}
              <div className="bg-brand-50/70 border border-brand-100 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-brand-600 text-white rounded-md shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      {aiPrompt?.headline || 'Is this what you really want to purchase?'}
                    </h4>
                    <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                      {aiPrompt?.summaryText}
                    </p>
                  </div>
                </div>
              </div>

              {/* Verified Product Breakdown */}
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Item Specifications Recorded for Evidence
                </div>
                {order.items.map((item, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 object-cover rounded-md border border-slate-200 shrink-0"
                      />
                      <div>
                        <h5 className="text-sm font-semibold text-slate-900">{item.productName}</h5>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Variant: <span className="font-medium text-slate-700">{item.variantName || 'Standard'}</span> · Qty: {item.quantity}
                        </p>
                        <p className="text-xs text-slate-500">
                          Seller: <span className="font-medium text-slate-700">{order.sellerName}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-slate-900 tabular-nums">
                        ₦{item.subtotal.toLocaleString('en-NG')}
                      </div>
                      <span className="text-[11px] text-emerald-600 font-medium">Escrow Protected</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Key Checkpoints */}
              <div>
                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Agreed Transaction & Delivery Checkpoints
                </h5>
                <ul className="space-y-2">
                  {aiPrompt?.keyCheckpoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Financial Breakdown & Escrow Note */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-slate-900 tabular-nums">₦{order.subtotal.toLocaleString('en-NG')}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>VeriPay Escrow Custody Fee (1.5%)</span>
                  <span className="font-semibold text-slate-900 tabular-nums">₦{order.escrowFee.toLocaleString('en-NG')}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                  <span>Total Escrow Lock</span>
                  <span className="text-brand-600 tabular-nums">₦{order.totalAmount.toLocaleString('en-NG')}</span>
                </div>
                <p className="text-xs text-slate-500 pt-2 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {aiPrompt?.escrowNote}
                </p>
              </div>

              {/* Buyer Confirmation Checkbox */}
              <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={buyerAgreed}
                  onChange={(e) => setBuyerAgreed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs text-slate-700 leading-normal">
                  <strong>Yes, this is what I want to purchase.</strong> I understand VeriPay will create an immutable, SHA-256 hashed purchase snapshot to serve as uncontestable baseline evidence for my delivery guarantee.
                </span>
              </label>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <FileCheck2 className="w-4 h-4 text-slate-400" />
            <span>Automatic SHA-256 snapshot will seal upon confirmation</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors"
            >
              Back to Cart
            </button>
            <button
              onClick={handleConfirm}
              disabled={!buyerAgreed || loading || confirming}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
            >
              {confirming ? 'Sealing Snapshot...' : 'Confirm & Proceed to Escrow Payment'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
