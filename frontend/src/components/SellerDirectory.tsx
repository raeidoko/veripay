/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SellerProfile } from '../types';
import { SEED_SELLERS } from '../seedData';
import { Star, ShieldAlert, BadgeCheck, Phone, ShoppingBag, ArrowRight, QrCode, Search, Filter } from 'lucide-react';

interface SellerDirectoryProps {
  onSelectSeller: (seller: SellerProfile) => void;
  onScanSellerQR: (seller: SellerProfile) => void;
}

export default function SellerDirectory({ onSelectSeller, onScanSellerQR }: SellerDirectoryProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Fashion & Apparel', 'Electronics & Gadgets', 'Footwear & Luxury', 'Lifestyle & Thrift'];

  const filteredSellers = SEED_SELLERS.filter((seller) => {
    const matchesSearch = seller.name.toLowerCase().includes(search.toLowerCase()) || 
                          seller.handle.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || seller.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getTrustScoreColor = (score: number) => {
    if (score >= 95) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (score >= 90) return 'text-teal-600 bg-teal-50 border-teal-100';
    if (score >= 80) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-rose-600 bg-rose-50 border-rose-100';
  };

  return (
    <div id="seller-directory" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#0F172A] tracking-tight">Social Commerce Merchant Directory</h2>
          <p className="text-sm text-slate-500 mt-1">
            Browse verified Instagram, WhatsApp & TikTok vendors. Escrow protects your money with every order.
          </p>
        </div>
      </div>

      {/* Search & Filtering Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search vendor name or @handle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all bg-slate-50/50"
          />
        </div>

        {/* Category Pill Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat === 'All' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Seller Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSellers.map((seller) => (
          <div
            key={seller.id}
            id={`seller-card-${seller.id}`}
            className="border border-[#E2E8F0] rounded-2xl p-5 hover:shadow-md transition-all flex flex-col justify-between bg-white group shadow-sm"
          >
            <div>
              {/* Card Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-sans font-bold text-slate-800 text-base">{seller.name}</h3>
                    {seller.trustScore >= 95 && (
                      <BadgeCheck className="w-5 h-5 text-blue-500 fill-blue-500" title="Highly Trusted Seller" />
                    )}
                  </div>
                  <span className="text-xs text-[#2563EB] font-semibold block">{seller.handle}</span>
                </div>

                {/* Trust Score badge */}
                <div className={`px-2.5 py-1 rounded-xl border text-center font-sans ${getTrustScoreColor(seller.trustScore)}`}>
                  <div className="text-[10px] uppercase font-bold tracking-wider leading-none">Trust Score</div>
                  <div className="text-lg font-black leading-none mt-1">{seller.trustScore}%</div>
                </div>
              </div>

              {/* Category, Rating, Phone */}
              <div className="text-xs text-slate-500 space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider">{seller.category}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 font-semibold text-amber-500">
                    <Star className="w-3.5 h-3.5 fill-amber-500" /> {seller.rating.toFixed(1)}
                  </span>
                  <span>&bull;</span>
                  <span>{seller.successfulSales} successful sales</span>
                  <span>&bull;</span>
                  <span className="text-emerald-600 font-medium">{seller.activeEscrows} active escrows</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                  <Phone className="w-3 h-3 text-slate-400" /> {seller.phone}
                </div>
              </div>
            </div>

            {/* Quick Action footer */}
            <div className="flex items-center gap-2 border-t border-slate-100 pt-4 mt-2">
              <button
                onClick={() => onSelectSeller(seller)}
                className="flex-1 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <ShoppingBag className="w-3.5 h-3.5" /> Start Escrow Order <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => onScanSellerQR(seller)}
                className="p-2 bg-slate-100 hover:bg-[#2563EB]/10 hover:text-[#2563EB] text-slate-600 rounded-xl transition-all cursor-pointer"
                title="Scan Seller Pay QR"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filteredSellers.length === 0 && (
          <div className="col-span-2 text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <p className="text-sm text-slate-500 font-medium">No merchants found matching your query.</p>
          </div>
        )}
      </div>
    </div>
  );
}
