import React, { useState } from 'react';
import {
  FileText,
  Clock,
  Sparkles,
  UserCheck,
  CheckCircle,
  XCircle,
  PhoneCall,
  Send,
  MessageSquare,
  Lock,
  ArrowLeft,
  FileCheck2,
} from 'lucide-react';
import { Dispute, UserRole, DeliveryVerification } from '../shared/types.ts';
import { api } from '../client/api.ts';
import { DeliveryVerificationModal } from './DeliveryVerificationModal.tsx';

interface DisputeDetailViewProps {
  dispute: Dispute;
  userRole: UserRole;
  currentUserId: string;
  currentUserName: string;
  onBack: () => void;
  onUpdated: (updatedDispute: Dispute) => void;
}

export const DisputeDetailView: React.FC<DisputeDetailViewProps> = ({
  dispute,
  userRole,
  currentUserId,
  currentUserName,
  onBack,
  onUpdated,
}) => {
  const [showDverModal, setShowDverModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadType, setUploadType] = useState<'PHOTO' | 'WAYBILL' | 'RIDER_LOG' | 'CHAT_EXPORT'>('PHOTO');
  const [uploading, setUploading] = useState(false);

  // Info request response state
  const [respondingReqId, setRespondingReqId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  // Reviewer Consequential Decision state
  const [selectedDecision, setSelectedDecision] = useState<'BUYER_REFUNDED' | 'SELLER_PAID' | 'SPLIT' | null>(null);
  const [decisionRationale, setDecisionRationale] = useState('');
  const [deciding, setDeciding] = useState(false);

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim() || !uploadDesc.trim()) return;

    setUploading(true);
    try {
      const party = userRole === 'seller' ? 'SELLER' : userRole === 'buyer' ? 'BUYER' : 'REVIEWER';
      await api.addEvidence(dispute.id, {
        party,
        type: uploadType,
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        url: uploadUrl.trim() || undefined,
      });

      const refreshed = await api.getDisputeById(dispute.id);
      onUpdated(refreshed);
      setUploadTitle('');
      setUploadDesc('');
      setUploadUrl('');
      alert('Evidence item cryptographically sealed and attached.');
    } catch (err: any) {
      alert(err.message || 'Failed to submit evidence');
    } finally {
      setUploading(false);
    }
  };

  const handleSendInfoResponse = async (reqId: string) => {
    if (!responseText.trim()) return;
    setSubmittingResponse(true);
    try {
      await api.respondToInfoRequest(dispute.id, reqId, responseText.trim());
      const refreshed = await api.getDisputeById(dispute.id);
      onUpdated(refreshed);
      setRespondingReqId(null);
      setResponseText('');
    } catch (err: any) {
      alert(err.message || 'Failed to submit response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleConsequentialDecision = async () => {
    if (!selectedDecision || !decisionRationale.trim()) {
      alert('Reviewer decision rationale is mandatory for consequential outcomes.');
      return;
    }

    setDeciding(true);
    try {
      const decided = await api.decideDispute(dispute.id, {
        reviewerId: currentUserId,
        reviewerName: currentUserName,
        decision: selectedDecision,
        rationale: decisionRationale.trim(),
      });
      onUpdated(decided);
      alert(`Dispute decided as ${selectedDecision}. Consequential escrow release/refund executed.`);
    } catch (err: any) {
      alert(err.message || 'Failed to record decision');
    } finally {
      setDeciding(false);
    }
  };

  const handleDeliveryVerificationRecorded = async (_dver: DeliveryVerification) => {
    const refreshed = await api.getDisputeById(dispute.id);
    onUpdated(refreshed);
  };

  const getStateBadgeClass = (state: string) => {
    switch (state) {
      case 'OPENED':
      case 'EVIDENCE_COLLECTION':
        return 'bg-brand-50 text-brand-700 border-brand-200';
      case 'AI_ANALYSIS':
        return 'bg-brand-50 text-brand-700 border-brand-200';
      case 'REVIEWER_APPROVAL':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'REVIEWER_QUEUE':
        return 'bg-brand-50 text-brand-700 border-brand-200';
      case 'DECIDED':
      case 'CLOSED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top back bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Disputes Queue</span>
        </button>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getStateBadgeClass(dispute.state)}`}>
            {dispute.state.replace('_', ' ')}
          </span>
          {dispute.fastLaneEligible && (
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-emerald-100 text-emerald-800">
              Fast-Lane Eligible
            </span>
          )}
        </div>
      </div>

      {/* Case Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>Dispute #{dispute.id.slice(-8)}</span>
              <span>·</span>
              <span>Order #{dispute.orderNumber}</span>
              <span>·</span>
              <span>Filed by {dispute.openerName} ({dispute.openedBy})</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {dispute.reason.replace(/_/g, ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <span className="text-xs text-slate-500 block">Disputed Escrow Claim</span>
              <span className="text-xl font-bold text-slate-900 tabular-nums">
                ₦{dispute.claimedAmount.toLocaleString('en-NG')}
              </span>
            </div>
            {userRole === 'admin' && dispute.state !== 'DECIDED' && (
              <button
                onClick={() => setShowDverModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors shrink-0"
              >
                <PhoneCall className="w-3.5 h-3.5 text-brand-600" />
                <span>Verify Courier (F6)</span>
              </button>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200">
          <strong className="text-slate-900 font-semibold block mb-1">Initial Dispute Statement:</strong>
          {dispute.details}
        </div>
      </div>

      {/* AI Recommendation & Inconsistency Analysis Card (F3) */}
      {dispute.aiRecommendation && (
        <div className="bg-brand-50/50 border border-brand-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-brand-600 text-white rounded-lg">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Dispute Advisory Analysis
                </h3>
                <p className="text-[11px] text-slate-500">
                  Source: {dispute.aiRecommendation.source === 'rules' ? 'Built-in rules' : dispute.aiRecommendation.modelVersion} · Advisory Only (Human Decides)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Recommended:</span>
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-brand-600 text-white">
                {dispute.aiRecommendation.recommendedOutcome.replaceAll('_', ' ')}
              </span>
              <span className="text-xs font-semibold text-slate-700 bg-white px-2 py-1 rounded-md border border-brand-200 tabular-nums">
                {Math.round(dispute.aiRecommendation.confidence * 100)}% Confidence
              </span>
            </div>
          </div>

          {/* Inconsistencies detected */}
          {dispute.aiRecommendation.inconsistencies.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertCircleIcon className="w-3.5 h-3.5" /> Detected Inconsistencies:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-700 ml-1">
                {dispute.aiRecommendation.inconsistencies.map((inc, i) => (
                  <li key={i}>{inc}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Synthesized Findings */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Synthesized Findings from Hashed Baseline & Logs:
            </span>
            <ul className="space-y-1">
              {dispute.aiRecommendation.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {!!dispute.aiRecommendation.infoRequests?.length && (
            <div className="text-xs text-slate-700 space-y-1">
              <strong>Suggested questions for the reviewer:</strong>
              <ul className="list-disc list-inside">
                {dispute.aiRecommendation.infoRequests.map((request, i) => (
                  <li key={i}>{request.requestedFrom}: {request.question}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="text-xs text-slate-600 pt-2 border-t border-brand-100">
            <strong>Rationale:</strong> {dispute.aiRecommendation.rationale}
          </div>
        </div>
      )}

      {/* Grid: Evidence Timeline & AI Info Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Evidence Items Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">
              Tamper-Evident Evidence Timeline ({dispute.evidence.length})
            </h4>
            <span className="text-xs text-slate-500">Every item sealed with SHA-256</span>
          </div>

          <div className="space-y-3">
            {dispute.evidence.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-2 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                      item.party === 'SYSTEM'
                        ? 'bg-brand-100 text-brand-800'
                        : item.party === 'BUYER'
                        ? 'bg-brand-100 text-brand-800'
                        : item.party === 'SELLER'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-brand-100 text-brand-800'
                    }`}>
                      {item.party}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{item.title}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(item.uploadedAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{item.description}</p>

                {item.url && (
                  <div className="pt-1">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" /> View Attached File
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                  <FileCheck2 className="w-3 h-3 text-emerald-600" />
                  <span>SHA-256: {item.sha256}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Upload New Evidence Form */}
          {dispute.state !== 'DECIDED' && (
            <form onSubmit={handleUploadEvidence} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Upload Counter-Evidence or Documentation
              </h5>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Evidence title (e.g. Courier Receipt photo)"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-900"
                  required
                />
                <select
                  value={uploadType}
                  onChange={(e: any) => setUploadType(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-900"
                >
                  <option value="PHOTO">Photo / Inspection Image</option>
                  <option value="WAYBILL">Courier Waybill Document</option>
                  <option value="RIDER_LOG">Rider Geo / Phone Log</option>
                  <option value="CHAT_EXPORT">Communication Record</option>
                </select>
              </div>
              <textarea
                rows={2}
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
                placeholder="Description of this evidence and why it supports your position..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-900"
                required
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors"
                >
                  {uploading ? 'Hashing...' : 'Seal & Upload Evidence'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Col: AI Info Requests & Reviewer Actions */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
                <span>AI Clarification Inquiries</span>
              </h4>
              <span className="text-[11px] text-slate-500">{dispute.infoRequests.length} active</span>
            </div>

            {dispute.infoRequests.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No open information inquiries.</p>
            ) : (
              <div className="space-y-3">
                {dispute.infoRequests.map((req) => (
                  <div key={req.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-brand-900">To {req.requestedFrom}:</span>
                      <span className={req.status === 'ANSWERED' ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-medium'}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium">{req.question}</p>

                    {req.response ? (
                      <div className="p-2 bg-white rounded border border-slate-200 text-slate-700">
                        <strong className="text-[11px] text-slate-500 block">Response:</strong>
                        {req.response}
                      </div>
                    ) : req.requestedFrom === userRole.toUpperCase() ? (
                      <div>
                        {respondingReqId === req.id ? (
                          <div className="space-y-2 mt-2">
                            <textarea
                              rows={2}
                              value={responseText}
                              onChange={(e) => setResponseText(e.target.value)}
                              placeholder={`Enter ${req.requestedFrom} response...`}
                              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-900"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setRespondingReqId(null)}
                                className="px-2.5 py-1 text-[11px] text-slate-600 bg-white border border-slate-300 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendInfoResponse(req.id)}
                                disabled={submittingResponse}
                                className="px-3 py-1 text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded"
                              >
                                Submit Response
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setRespondingReqId(req.id);
                              setResponseText('');
                            }}
                            className="text-[11px] font-semibold text-brand-600 hover:underline"
                          >
                            + Reply to Inquiry
                          </button>
                        )}
                      </div>
                    ) : <p className="text-[11px] text-slate-500">Awaiting a response from the {req.requestedFrom.toLowerCase()}.</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consequential Decision Terminal (Reviewer / Admin Only) */}
          {userRole === 'admin' && (
            <div className="bg-slate-900 text-white rounded-lg p-5 shadow-md space-y-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Admin Dispute Decision
                </h4>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Humans stay in control of consequential money-moving decisions. AI is strictly advisory. Selecting an outcome triggers escrow release or refund.
              </p>

              {dispute.state === 'DECIDED' ? (
                <div className="p-3 bg-slate-800 rounded-md border border-slate-700 space-y-1">
                  <div className="text-xs font-bold text-emerald-400">
                    Decision: {dispute.decision}
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Decided by: {dispute.decidedBy}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Rationale: {dispute.decisionRationale}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-slate-300 font-medium mb-1">
                      Consequential Outcome:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedDecision('BUYER_REFUNDED')}
                        className={`p-2 text-center rounded text-xs font-bold transition-colors ${
                          selectedDecision === 'BUYER_REFUNDED'
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Refund Buyer
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDecision('SELLER_PAID')}
                        className={`p-2 text-center rounded text-xs font-bold transition-colors ${
                          selectedDecision === 'SELLER_PAID'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Pay Seller
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDecision('SPLIT')}
                        className={`p-2 text-center rounded text-xs font-bold transition-colors ${
                          selectedDecision === 'SPLIT'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Split (50/50)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 font-medium mb-1">
                      Mandatory Decision Rationale:
                    </label>
                    <textarea
                      rows={3}
                      value={decisionRationale}
                      onChange={(e) => setDecisionRationale(e.target.value)}
                      placeholder="Enter legal & factual rationale for audit log..."
                      className="w-full px-3 py-2 text-xs border border-slate-700 rounded bg-slate-800 text-white placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>

                  <button
                    onClick={handleConsequentialDecision}
                    disabled={deciding || !selectedDecision || !decisionRationale.trim()}
                    className="w-full py-2.5 text-xs font-bold text-slate-900 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-md transition-colors"
                  >
                    {deciding ? 'Executing Decision...' : 'Approve & Release Escrow Funds'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Courier verification modal */}
      <DeliveryVerificationModal
        dispute={dispute}
        isOpen={showDverModal}
        onClose={() => setShowDverModal(false)}
        onRecorded={handleDeliveryVerificationRecorded}
        currentUserName={currentUserName}
      />
    </div>
  );
};

function AlertCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
