import React, { useState } from 'react';
import { Truck, AlertCircle, CheckCircle2, User, Phone, Mail, Hash } from 'lucide-react';
import { Order, DispatchContact } from '../shared/types.ts';
import { api } from '../client/api.ts';

interface DispatchContactModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (contact: DispatchContact) => void;
}

export const DispatchContactModal: React.FC<DispatchContactModalProps> = ({
  order,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [contactType, setContactType] = useState<'RIDER' | 'COMPANY'>('RIDER');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [vehicleNotes, setVehicleNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const validatePhoneClient = (input: string) => {
    const cleaned = input.replace(/[\s\-()]/g, '');
    return /^(\+?234|0)[789][01]\d{8}$/.test(cleaned);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide rider or company name');
      return;
    }

    if (!validatePhoneClient(phone)) {
      setError('Please enter a valid Nigerian phone number (e.g. +234 803 123 4567 or 08031234567)');
      return;
    }

    if (contactType === 'COMPANY' && !phone.trim() && !email.trim()) {
      setError('Logistics companies require a phone number or contact email');
      return;
    }

    setSaving(true);
    try {
      const contact = await api.saveDispatchContact(order.id, {
        sellerId: order.sellerId,
        sellerName: order.sellerName,
        type: contactType,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
        vehicleNotes: vehicleNotes.trim() || undefined,
      });

      onSaved(contact);
    } catch (err: any) {
      setError(err.message || 'Failed to save dispatch contact');
    } finally {
      setSaving(false);
    }
  };

  // Preset quick fill for test convenience
  const handleQuickFill = (type: 'rider' | 'company') => {
    if (type === 'rider') {
      setContactType('RIDER');
      setName('Babatunde Alimi');
      setPhone('+234 803 234 5678');
      setTrackingNumber(`VP-DISP-${Math.floor(10000 + Math.random() * 90000)}`);
      setVehicleNotes('Bajaj Boxer Red (Reg: KJA-482-XY)');
    } else {
      setContactType('COMPANY');
      setName('GIG Logistics Express');
      setPhone('+234 813 900 1234');
      setEmail('dispatch@giglogistics.ng');
      setTrackingNumber(`GIG-LGS-${Math.floor(10000 + Math.random() * 90000)}`);
      setVehicleNotes('Fleet Van dispatch');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-400/30">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                F6 Dispatch Verification Protocol
              </h3>
              <p className="text-xs text-slate-300">
                Register verified rider or courier contact before order dispatch
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">
            Cancel
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Dispatch Gate Notice:</strong> VeriPay requires independent courier contact details for Order #{order.orderNumber}. If non-delivery is reported, this contact is independently phoned/messaged for delivery verification.
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-slate-700">Contact Category</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('rider')}
                className="text-[11px] text-brand-600 hover:underline"
              >
                + Preset Rider
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => handleQuickFill('company')}
                className="text-[11px] text-brand-600 hover:underline"
              >
                + Preset Company
              </button>
            </div>
          </div>

          {/* Type Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setContactType('RIDER')}
              className={`p-3 text-left border rounded-lg text-xs font-medium transition-all ${
                contactType === 'RIDER'
                  ? 'bg-brand-50/80 border-brand-500 text-brand-900 ring-1 ring-brand-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Individual Dispatch Rider
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Bike rider, delivery personnel phone</p>
            </button>

            <button
              type="button"
              onClick={() => setContactType('COMPANY')}
              className={`p-3 text-left border rounded-lg text-xs font-medium transition-all ${
                contactType === 'COMPANY'
                  ? 'bg-brand-50/80 border-brand-500 text-brand-900 ring-1 ring-brand-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" /> Logistics Company
              </div>
              <p className="text-[11px] text-slate-500 mt-1">GIG, Kwik, DHL, Red Star, etc.</p>
            </button>
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {contactType === 'RIDER' ? 'Rider Full Name *' : 'Logistics Company Name *'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={contactType === 'RIDER' ? 'e.g. Babatunde Alimi' : 'e.g. Kwik Logistics Express'}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-slate-900"
              required
            />
          </div>

          {/* Nigerian Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Nigerian Contact Phone Number *</span>
              <span className="text-[11px] text-slate-400 font-normal">+234 / 080 / 081 / 070</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 803 234 5678"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-mono text-slate-900"
                required
              />
            </div>
          </div>

          {/* Email (Optional for rider, recommended for company) */}
          {contactType === 'COMPANY' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Support / Dispatch Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dispatch@carrier.ng"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-slate-900"
                />
              </div>
            </div>
          )}

          {/* Tracking / Waybill Number */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Waybill / Tracking #
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. VP-DISP-78902"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-mono text-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vehicle Notes / Bike Reg
              </label>
              <input
                type="text"
                value={vehicleNotes}
                onChange={(e) => setVehicleNotes(e.target.value)}
                placeholder="e.g. Boxer Red (KJA-482)"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-slate-900"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action buttons */}
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
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? 'Validating...' : 'Save & Enable Dispatch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
