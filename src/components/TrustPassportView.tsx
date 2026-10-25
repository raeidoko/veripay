import React, { useState, useEffect } from 'react';
import {
  Award,
  Crown,
  Shield,
  CheckCircle2,
  Clock,
  HelpCircle,
  Flag,
  ArrowUpRight,
  TrendingUp,
  FileCheck2,
  Check,
  X,
} from 'lucide-react';
import { TrustProfile, TrustEvent, TrustChallenge, UserProfile } from '../shared/types.ts';
import { api } from '../client/api.ts';
import { TrustBadge } from './TrustBadge.tsx';

interface TrustPassportViewProps {
  currentUserId: string;
  currentUserName: string;
  userRole: string;
}

export const TrustPassportView: React.FC<TrustPassportViewProps> = ({
  currentUserId,
  currentUserName,
  userRole,
}) => {
  const [profile, setProfile] = useState<TrustProfile | null>(null);
  const [events, setEvents] = useState<TrustEvent[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const isStaff = userRole === 'admin';
  const [registryUsers, setRegistryUsers] = useState<UserProfile[]>([]);
  useEffect(() => {
    if (isStaff) api.getUsers().then(setRegistryUsers).catch(console.error);
  }, [isStaff]);
  const [loading, setLoading] = useState(true);

  // Contest / Challenge state
  const [challengingEventId, setChallengingEventId] = useState<string | null>(null);
  const [challengeReason, setChallengeReason] = useState('');
  const [submittingChallenge, setSubmittingChallenge] = useState(false);

  const fetchPassportData = async (uid: string) => {
    setLoading(true);
    try {
      const data = await api.getPassportFactors(uid);
      setProfile(data.profile);
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPassportData(selectedUserId);
  }, [selectedUserId]);

  const handleChallengeSubmit = async (eventId: string) => {
    if (!challengeReason.trim()) {
      alert('Please describe why you are contesting this record');
      return;
    }

    setSubmittingChallenge(true);
    try {
      await api.challengeTrustRecord({
        eventId,
        userId: selectedUserId,
        userName: profile?.userName || currentUserName,
        reason: challengeReason.trim(),
      });
      setChallengingEventId(null);
      setChallengeReason('');
      fetchPassportData(selectedUserId);
      alert('Record contested. Event is marked UNDER_REVIEW and excluded from your reliability score until decided.');
    } catch (err: any) {
      alert(err.message || 'Failed to contest record');
    } finally {
      setSubmittingChallenge(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Selector for demonstration */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            {isStaff ? 'Trust Passport Registry' : 'My Trust Passport'}
          </h3>
          <p className="text-xs text-slate-500">
            {isStaff ? 'Inspect account reliability and the evidence behind each trust profile.' : 'View your reliability factors and challenge inaccurate records on your account.'}
          </p>
        </div>

        {isStaff && <select aria-label="Trust registry account" value={selectedUserId}
          onChange={e => { setSelectedUserId(e.target.value); setChallengingEventId(null); }}
          className="max-w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700">
          {registryUsers.map(user => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}
        </select>}
      </div>

      {loading || !profile ? (
        <div className="py-16 text-center text-xs text-slate-500">Loading Trust Passport...</div>
      ) : (
        <>
          {/* Main Passport Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 text-white rounded-2xl p-8 shadow-xl border border-slate-700 relative overflow-hidden">
            {/* Background seal pattern */}
            <div className="absolute right-4 -bottom-10 opacity-10 pointer-events-none">
              <Crown className="w-80 h-80 text-white" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-brand-400">
                    Official VeriPay Escrow Passport 2.0
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-xs text-slate-400">Updated {new Date(profile.updatedAt).toLocaleDateString()}</span>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-white">
                  {profile.userName}
                </h2>

                {/* Level Badge and Identity Verified Separated */}
                <div className="pt-1 flex items-center gap-3 flex-wrap">
                  <TrustBadge
                    level={profile.level}
                    score={profile.reliabilityScore}
                    showScore={false}
                    size="lg"
                  />
                  {profile.identityVerified && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Identity Verified: {profile.identityCheckMethod}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Reliability Score Dial */}
              <div className="p-6 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 text-center shrink-0 min-w-[200px]">
                <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">
                  Demonstrated Reliability
                </span>
                <div className="text-4xl font-black tracking-tight text-white tabular-nums">
                  {profile.reliabilityScore}
                  <span className="text-xl text-slate-400 font-normal">/100</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-semibold block mt-1">
                  {profile.level === 'CROWN' ? 'Top 1% Benchmark' : 'Above Marketplace Median'}
                </span>
              </div>
            </div>
          </div>

          {/* "Why this level" Transparent Factors Screen */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Transparent Factor Breakdown · "Why This Level"
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                VeriPay Trust Passport rewards demonstrated reliability over time, not transaction volume alone.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="text-xs text-slate-500 font-medium">Verified Transactions</span>
                <div className="text-2xl font-bold text-slate-900 tabular-nums">
                  {profile.factors.verifiedTransactions}
                </div>
                <p className="text-[11px] text-slate-500">
                  Completed without substantiated dispute
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="text-xs text-slate-500 font-medium">F6 On-Time Delivery Rate</span>
                <div className="text-2xl font-bold text-slate-900 tabular-nums">
                  {profile.factors.onTimeDeliveryRate}%
                </div>
                <p className="text-[11px] text-slate-500">
                  Verified via {profile.factors.dispatchVerifiedCount} rider records
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="text-xs text-slate-500 font-medium">Cooperation Score</span>
                <div className="text-2xl font-bold text-slate-900 tabular-nums">
                  {profile.factors.cooperationScore}%
                </div>
                <p className="text-[11px] text-slate-500">
                  Speed of response to AI info inquiries
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="text-xs text-slate-500 font-medium">Substantiated Disputes</span>
                <div className="text-2xl font-bold text-slate-900 tabular-nums">
                  {profile.factors.substantiatedDisputes}
                </div>
                <p className="text-[11px] text-emerald-600 font-medium">
                  {profile.factors.unprovenComplaintsExcluded} unproven complaints excluded
                </p>
              </div>
            </div>

            {/* Criteria for level advancement */}
            <div className="bg-brand-50/60 border border-brand-100 rounded-lg p-4 space-y-2 text-xs text-brand-950">
              <div className="font-bold flex items-center gap-1.5 text-brand-900">
                <TrendingUp className="w-4 h-4 text-brand-600" />
                <span>Tier Progression Rules:</span>
              </div>
              <p className="leading-relaxed">
                • <strong>Bronze to Silver:</strong> Requires ≥10 verified transactions, 0 active disputes, and ≥80 reliability.<br />
                • <strong>Silver to Gold:</strong> Requires ≥25 verified transactions, sustained performance, and verified phone/NIN credentials.<br />
                • <strong>Gold to Crown:</strong> Requires ≥50 verified transactions, 180+ days clean dispute history, CAC/NIN verification, and ≥95 reliability. Volume alone can never skip tiers.
              </p>
            </div>
          </div>

          {/* Dynamic Trust Events & Challenge Inaccurate Records */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Verified Trust Events History ({events.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Contest inaccurate records: Contested records are immediately marked "Under Review" and excluded from scoring.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {events.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">No trust events logged yet.</div>
              ) : (
                events.map((ev) => (
                  <div key={ev.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {ev.type.replace(/_/g, ' ')}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                          ev.status === 'UNDER_REVIEW'
                            ? 'bg-amber-100 text-amber-800'
                            : ev.status === 'REVOKED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {ev.status}
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          Weight: {ev.weight > 0 ? `+${ev.weight}` : ev.weight}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{ev.description}</p>
                      <span className="text-[11px] text-slate-400 block">
                        {new Date(ev.timestamp).toLocaleString()}
                      </span>
                    </div>

                    {/* Challenge Button */}
                    {selectedUserId === currentUserId && ev.status === 'ACTIVE' && (
                      <div className="shrink-0">
                        {challengingEventId === ev.id ? (
                          <div className="p-3 bg-white border border-slate-300 rounded-lg space-y-2 max-w-sm">
                            <span className="text-xs font-bold text-slate-800 block">Contest this record:</span>
                            <input
                              type="text"
                              value={challengeReason}
                              onChange={(e) => setChallengeReason(e.target.value)}
                              placeholder="Reason for challenge..."
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded text-slate-900"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setChallengingEventId(null)}
                                className="px-2 py-1 text-[11px] text-slate-600 border border-slate-200 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleChallengeSubmit(ev.id)}
                                disabled={submittingChallenge}
                                className="px-3 py-1 text-[11px] font-semibold text-white bg-brand-600 rounded"
                              >
                                Submit Challenge
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setChallengingEventId(ev.id);
                              setChallengeReason('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                          >
                            <Flag className="w-3.5 h-3.5 text-amber-500" />
                            <span>Challenge Record</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
