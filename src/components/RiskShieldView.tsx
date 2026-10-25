import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Link2,
  CheckCircle,
  XCircle,
  UserX,
  FileCheck,
  RefreshCw,
  Search,
} from 'lucide-react';
import { RiskAssessment, IdentityLink } from '../shared/types.ts';
import { api } from '../client/api.ts';

interface RiskShieldViewProps {
  currentUserId: string;
  currentUserName: string;
}

export const RiskShieldView: React.FC<RiskShieldViewProps> = ({
  currentUserId,
  currentUserName,
}) => {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [links, setLinks] = useState<IdentityLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [selectedAction, setSelectedAction] = useState<'RELEASE_HOLD' | 'CONFIRM_RESTRICTION' | 'CLEAR_FLAG'>('RELEASE_HOLD');

  const fetchRiskData = async () => {
    setLoading(true);
    try {
      const data = await api.getRiskQueue();
      setAssessments(data.assessments || []);
      setLinks(data.links || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
  }, []);

  const handleResolveAssessment = async (assessmentId: string) => {
    if (!resolutionNotes.trim()) {
      alert('Resolution notes are mandatory for risk compliance logs.');
      return;
    }

    try {
      await api.resolveRisk(assessmentId, {
        reviewerId: currentUserId,
        reviewerName: currentUserName,
        action: selectedAction,
        resolutionNotes: resolutionNotes.trim(),
      });
      setResolvingId(null);
      setResolutionNotes('');
      fetchRiskData();
      alert('Risk assessment updated.');
    } catch (err: any) {
      alert(err.message || 'Failed to resolve assessment');
    }
  };

  const handleDecideIdentityLink = async (linkId: string, status: 'CONFIRMED' | 'CLEARED') => {
    try {
      await api.decideIdentityLink(linkId, {
        reviewerId: currentUserId,
        reviewerName: currentUserName,
        status,
      });
      fetchRiskData();
      alert(`Identity link status set to ${status}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to update link status');
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'CONFIRMED':
        return 'bg-brand-100 text-brand-900 border-brand-300';
      case 'HIGH':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'LOW':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>F4 Intelligent Transaction Risk & Identity Linking</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Admin Risk Console
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Multi-signal scoring (volume spikes, new account high value, dispatch anomalies) and cryptographic salted hash matching against watchlisted fraudsters to prevent ban evasion.
          </p>
        </div>

        <button
          onClick={fetchRiskData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors self-start md:self-auto shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Grid: Linked Identities & Risk Assessments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Col: Linked Identity Signals */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-brand-600" />
              <span>Multi-Account Identity Links</span>
            </h3>
            <span className="text-xs text-slate-500">{links.length} discovered</span>
          </div>

          <div className="space-y-3">
            {links.map((link) => (
              <div
                key={link.id}
                className={`p-4 rounded-xl border transition-all ${
                  link.status === 'CONFIRMED'
                    ? 'bg-rose-50/60 border-rose-200'
                    : link.status === 'CLEARED'
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : 'bg-white border-amber-300 ring-1 ring-amber-300/60'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-slate-900">
                    Match: {link.matchedAttribute}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                    link.status === 'CONFIRMED'
                      ? 'bg-rose-200 text-rose-900'
                      : link.status === 'CLEARED'
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {link.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-700">
                  <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-500">Flagged Entity:</span>
                    <span className="font-bold text-rose-700">{link.userAName}</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-500">Suspect Account:</span>
                    <span className="font-bold text-slate-900">{link.userBName}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 mt-2.5 leading-normal">
                  {link.matchDetails}
                </p>

                {link.status === 'SUSPECTED' && (
                  <div className="pt-3 mt-2 border-t border-slate-200/60 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleDecideIdentityLink(link.id, 'CLEARED')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition-colors"
                    >
                      Clear Match
                    </button>
                    <button
                      onClick={() => handleDecideIdentityLink(link.id, 'CONFIRMED')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors"
                    >
                      Confirm Watchlist Link
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right 2 Cols: Risk Assessment & Hold Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Transaction & Account Risk Queue ({assessments.length})
            </h3>
            <span className="text-xs text-slate-500">Automated Risk Engine v4</span>
          </div>

          <div className="space-y-3">
            {assessments.map((a) => (
              <div
                key={a.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-800">
                      {a.score}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {a.subjectType} #{a.subjectId}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${getLevelBadge(a.level)}`}>
                          {a.level} RISK
                        </span>
                        {a.state === 'HELD' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-600 text-white animate-pulse">
                            RISK HOLD
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Assessed on {new Date(a.createdAt).toLocaleString()} · Model {a.modelVersion}
                      </span>
                    </div>
                  </div>

                  {a.state === 'HELD' && (
                    <button
                      onClick={() => setResolvingId(resolvingId === a.id ? null : a.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors self-start sm:self-auto"
                    >
                      {resolvingId === a.id ? 'Close Terminal' : 'Review & Resolve'}
                    </button>
                  )}
                </div>

                {/* Risk Reasons */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Triggered Signals & Anomaly Factors:
                  </span>
                  <ul className="space-y-1">
                    {a.reasons.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Inline Resolver Form */}
                {resolvingId === a.id && (
                  <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Reviewer Consequential Resolution
                    </h5>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAction('RELEASE_HOLD')}
                        className={`p-2 text-xs font-semibold rounded-md border transition-colors ${
                          selectedAction === 'RELEASE_HOLD'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        Release Hold (Normal)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedAction('CLEAR_FLAG')}
                        className={`p-2 text-xs font-semibold rounded-md border transition-colors ${
                          selectedAction === 'CLEAR_FLAG'
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        Clear False Flag
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedAction('CONFIRM_RESTRICTION')}
                        className={`p-2 text-xs font-semibold rounded-md border transition-colors ${
                          selectedAction === 'CONFIRM_RESTRICTION'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        Confirm & Ban Account
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Mandatory reviewer rationale for compliance audit..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-900"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setResolvingId(null)}
                        className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-300 rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveAssessment(a.id)}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                      >
                        Submit Resolution
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
