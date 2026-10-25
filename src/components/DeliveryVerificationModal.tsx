import React, { useState } from 'react';
import { PhoneCall, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Dispute, DeliveryVerification } from '../shared/types.ts';
import { api } from '../client/api.ts';

interface DeliveryVerificationModalProps {
  dispute: Dispute;
  isOpen: boolean;
  onClose: () => void;
  onRecorded: (verification: DeliveryVerification) => void;
  currentUserName: string;
}

export const DeliveryVerificationModal: React.FC<DeliveryVerificationModalProps> = ({
  dispute,
  isOpen,
  onClose,
  onRecorded,
  currentUserName,
}) => {
  const [method, setMethod] = useState<'REVIEWER_PHONE_CALL' | 'AUTOMATED_SMS_CALL'>('REVIEWER_PHONE_CALL');
  const [outcome, setOutcome] = useState<'CONFIRMED_DELIVERED' | 'NOT_DELIVERED' | 'UNREACHABLE'>('NOT_DELIVERED');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      alert('Please enter detailed verification notes from the courier contact');
      return;
    }

    setSubmitting(true);
    try {
      const dver = await api.recordDeliveryVerification(dispute.id, {
        orderId: dispute.orderId,
        contactId: `disp_${dispute.orderId}`,
        agentName: currentUserName || 'Tunde Bakare (Admin)',
        method,
        outcome,
        notes: notes.trim(),
      });
      onRecorded(dver);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to record delivery verification');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePresetNote = (type: 'confirmed' | 'failed' | 'unreachable') => {
    if (type === 'confirmed') {
      setOutcome('CONFIRMED_DELIVERED');
      setNotes('Spoke with assigned rider. Rider provided recipient security confirmation PIN and photo of signed delivery waybill at security gate.');
    } else if (type === 'failed') {
      setOutcome('NOT_DELIVERED');
      setNotes('Contacted carrier dispatch supervisor. Logistics vehicle experienced breakdown; package was recalled to regional hub and never delivered to buyer.');
    } else {
      setOutcome('UNREACHABLE');
      setNotes('Attempted 3 phone calls across 2 hours. Rider phone rang out without answer. SMS delivery inquiry unacknowledged.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-400/30">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                F6 Independent Dispatch Verification
              </h3>
              <p className="text-xs text-slate-300">
                Contact rider or carrier for Order #{dispute.orderNumber}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Record independent third-party findings directly from the registered dispatch rider or logistics carrier. The result will become tamper-evident evidence in Dispute #{dispute.id.slice(-6)} and feed AI triage.
          </p>

          {/* Verification Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contact Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod('REVIEWER_PHONE_CALL')}
                className={`p-2.5 text-xs text-left border rounded-lg font-medium ${
                  method === 'REVIEWER_PHONE_CALL'
                    ? 'border-brand-600 bg-brand-50 text-brand-900'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Reviewer Direct Voice Call
              </button>
              <button
                type="button"
                onClick={() => setMethod('AUTOMATED_SMS_CALL')}
                className={`p-2.5 text-xs text-left border rounded-lg font-medium ${
                  method === 'AUTOMATED_SMS_CALL'
                    ? 'border-brand-600 bg-brand-50 text-brand-900'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Automated Carrier SMS / API
              </button>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-slate-700">Audit Outcome</span>
            <div className="flex items-center gap-1.5 text-[11px] text-brand-600">
              <button type="button" onClick={() => handlePresetNote('failed')} className="hover:underline">
                Preset Transit Failure
              </button>
              <span className="text-slate-300">·</span>
              <button type="button" onClick={() => handlePresetNote('confirmed')} className="hover:underline">
                Preset Confirmed
              </button>
            </div>
          </div>

          {/* Outcome Selectors */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setOutcome('NOT_DELIVERED')}
              className={`p-3 text-center border rounded-lg text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                outcome === 'NOT_DELIVERED'
                  ? 'border-rose-500 bg-rose-50 text-rose-800 ring-1 ring-rose-500'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Not Delivered</span>
            </button>

            <button
              type="button"
              onClick={() => setOutcome('CONFIRMED_DELIVERED')}
              className={`p-3 text-center border rounded-lg text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                outcome === 'CONFIRMED_DELIVERED'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Delivered</span>
            </button>

            <button
              type="button"
              onClick={() => setOutcome('UNREACHABLE')}
              className={`p-3 text-center border rounded-lg text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                outcome === 'UNREACHABLE'
                  ? 'border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-500'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Unreachable</span>
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Verification Call Log & Evidentiary Notes *
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Spoke with rider/operations lead. Package returned to warehouse due to transit accident..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-slate-900"
              required
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
            >
              {submitting ? 'Recording...' : 'Record Verification Evidence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
