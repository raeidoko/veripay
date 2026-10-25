import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, Filter, FileText, CheckCircle2 } from 'lucide-react';
import { AuditLogEntry } from '../shared/types.ts';
import { api } from '../client/api.ts';

export const AuditTrailView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = filterType === 'ALL'
    ? logs
    : logs.filter((l) => l.entityType === filterType);

  const getEntityBadge = (type: string) => {
    switch (type) {
      case 'ORDER':
        return 'bg-brand-100 text-brand-800';
      case 'DISPUTE':
        return 'bg-brand-100 text-brand-800';
      case 'SNAPSHOT':
        return 'bg-brand-100 text-brand-800';
      case 'RISK':
        return 'bg-rose-100 text-rose-800';
      case 'TRUST':
        return 'bg-amber-100 text-amber-800';
      case 'DISPATCH':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Cryptographic Governance & Transparency</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Append-Only Immutable Audit Log
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Every state change, escrow release, AI recommendation, reviewer decision, and trust score recalculation is permanently chained with SHA-256 cryptographic hashes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 font-medium"
          >
            <option value="ALL">All Categories</option>
            <option value="USER">Account approvals</option>
            <option value="DOCUMENT">Document reviews</option>
            <option value="PRODUCT">Product moderation</option>
            <option value="REVIEW">Review moderation</option>
            <option value="PLATFORM">Platform settings</option>
            <option value="ORDER">Orders & Escrow</option>
            <option value="SNAPSHOT">Purchase Snapshots (F2)</option>
            <option value="DISPUTE">Disputes (F3)</option>
            <option value="RISK">Risk & Links (F4)</option>
            <option value="TRUST">Trust Passport (F5)</option>
            <option value="DISPATCH">Dispatch (F6)</option>
          </select>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Logs Table / Timeline */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="divide-y divide-slate-100">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No audit log records found.</div>
          ) : (
            filteredLogs.map((entry) => (
              <div key={entry.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${getEntityBadge(entry.entityType)}`}>
                      {entry.entityType}
                    </span>
                    <span className="text-xs font-bold text-slate-900 font-mono">
                      {entry.action}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-600">
                      Actor: <strong className="text-slate-900">{entry.actorName}</strong> ({entry.actorRole})
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-normal">
                  {entry.changesSummary}
                </p>

                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono pt-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">Block Hash: {entry.sha256Hash}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
