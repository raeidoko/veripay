/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { Transaction } from '../types';
import VeriPayLogo from './VeriPayLogo';
import { CheckCircle, ShieldAlert, Award, Calendar, Phone, DollarSign, Download, Printer } from 'lucide-react';

interface DigitalReceiptProps {
  transaction: Transaction;
  onClose: () => void;
}

export default function DigitalReceipt({ transaction, onClose }: DigitalReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  // Simple print handler
  const handlePrint = () => {
    const printContent = receiptRef.current?.innerHTML;
    const originalContent = document.body.innerHTML;
    
    if (printContent) {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`
          <html>
            <head>
              <title>VeriPay Receipt - ${transaction.id}</title>
              <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
              <style>
                body { font-family: 'Inter', sans-serif; background: white; padding: 40px; }
              </style>
            </head>
            <body>
              <div class="max-w-xl mx-auto border p-8 rounded-lg">
                ${printContent}
              </div>
            </body>
          </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => {
          win.print();
          win.close();
        }, 500);
      }
    }
  };

  const formattedAmount = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(transaction.amount);

  const formattedFee = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(transaction.amount * 0.015); // 1.5% OPay standard escrow fee

  const formattedTotal = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(transaction.amount + transaction.amount * 0.015);

  return (
    <div
      id="receipt-modal"
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Actions Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
          <h3 className="font-sans font-bold text-slate-800">VeriPay Digital Receipt</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 text-slate-600 hover:text-[#2563EB] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Print Receipt"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-[#0F172A] text-white hover:bg-opacity-90 rounded-lg transition-all cursor-pointer font-medium"
            >
              Close
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div ref={receiptRef} className="p-8 overflow-y-auto flex-1 font-sans">
          <div className="flex flex-col items-center text-center border-b border-dashed border-slate-200 pb-6 mb-6">
            <VeriPayLogo size="md" showSubtitle={true} className="mb-4" />
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100 uppercase tracking-wider mb-2">
              <CheckCircle className="w-3.5 h-3.5" /> Securely Escrowed & Released
            </div>
            
            <span className="text-xs text-slate-400 font-mono">OPAY SECURITY REFERENCE: TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}</span>
          </div>

          <div className="space-y-4">
            {/* Amount Banner */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1">Transaction Value</span>
              <span className="text-3xl font-extrabold text-[#0F172A]">{formattedAmount}</span>
            </div>

            {/* Core Metadata */}
            <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-100 pb-4">
              <div>
                <span className="text-slate-400 block mb-1">Receipt ID</span>
                <span className="font-mono font-bold text-slate-800">{transaction.id}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Settlement Date</span>
                <span className="font-medium text-slate-800">
                  {new Date(transaction.createdAt).toLocaleDateString('en-NG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Buyer/Seller Breakdown */}
            <div className="space-y-3 py-2 border-b border-slate-100 pb-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Buyer Name</span>
                <span className="font-semibold text-slate-800">{transaction.buyerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Seller Merchant</span>
                <div className="text-right">
                  <span className="font-semibold text-slate-800 block">{transaction.sellerName}</span>
                  <span className="text-xs text-[#2563EB] font-semibold">{transaction.sellerHandle}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Delivery Partner</span>
                <span className="font-semibold text-slate-800">{transaction.deliveryPartner}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tracking Reference</span>
                <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{transaction.trackingNumber || 'LOCAL-DELIVERY'}</span>
              </div>
            </div>

            {/* Item Breakdown & Terms */}
            <div className="space-y-2 py-2 text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider block">Agreements & Item Details</span>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-slate-800 font-bold">
                  <span>1x {transaction.productName}</span>
                  <span>{formattedAmount}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 italic leading-relaxed border-t border-slate-200/60 pt-2">
                  &ldquo;{transaction.terms}&rdquo;
                </p>
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="space-y-2 pt-2 text-sm border-t border-slate-200">
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Subtotal</span>
                <span>{formattedAmount}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>OPay Escrow Admin Fee (1.5%)</span>
                <span>{formattedFee}</span>
              </div>
              <div className="flex justify-between text-[#0F172A] font-extrabold text-base border-t border-dashed border-slate-200 pt-2">
                <span>Total Settled</span>
                <span>{formattedTotal}</span>
              </div>
            </div>

            {/* Security Guarantee Badge */}
            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 flex gap-3 mt-4 items-center">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex-shrink-0 flex items-center justify-center text-[#2563EB]">
                <Award className="w-4 h-4" />
              </div>
              <div className="text-[10px] leading-relaxed">
                <p className="font-bold text-white uppercase tracking-wider mb-0.5">Verified OPay Escrow</p>
                <p className="text-slate-400">VeriPay is secured using 256-bit encryption. Funds were held in a temporary holding trust account managed securely by OPay Fintech.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
