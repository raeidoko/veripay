import {
  Dispute,
  DisputeOutcome,
  DisputeState,
  AIRecommendation,
  InfoRequest,
  EvidenceItem,
} from '../../shared/types.ts';
import { disputes, orders, purchaseSnapshots, deliveryVerifications } from '../db/store.ts';
import { aiLayer } from './aiLayer.ts';
import { auditLogService } from './auditLogService.ts';
import { orderEscrowService } from './orderEscrowService.ts';
import { trustService } from './trustService.ts';
import { walletService } from './walletService.ts';
import { choice, text } from '../utils/validation.ts';
import { randomUUID } from 'node:crypto';

export const disputeService = {
  getAllDisputes(): Dispute[] {
    return [...disputes].reverse();
  },

  getDisputeById(id: string): Dispute | undefined {
    return disputes.find((d) => d.id === id);
  },

  getDisputeByOrderId(orderId: string): Dispute | undefined {
    return disputes.find((d) => d.orderId === orderId);
  },

  /**
   * Opens a new dispute on an escrow order
   * Automatically attaches Purchase Snapshot (F2) as baseline evidence!
   */
  async openDispute(params: {
    orderId: string;
    openedBy: 'BUYER' | 'SELLER';
    openerName: string;
    reason: 'NON_DELIVERY' | 'ITEM_NOT_AS_DESCRIBED' | 'COUNTERFEIT_SUSPICION' | 'DAMAGED_IN_TRANSIT';
    details: string;
    claimedAmount: number;
  }): Promise<Dispute> {
    const order = orders.find((o) => o.id === params.orderId);
    if (!order) throw new Error('Order not found');
    if (!['PAYMENT_SECURED','DISPATCHED','IN_TRANSIT','DELIVERED'].includes(order.state) || !walletService.isFunded(order.id)) throw new Error('Only an active funded order can be disputed');
    if (disputes.some(dispute => dispute.orderId === order.id)) throw new Error('This order already has a dispute');
    choice(params.reason, ['NON_DELIVERY','ITEM_NOT_AS_DESCRIBED','COUNTERFEIT_SUSPICION','DAMAGED_IN_TRANSIT'], 'dispute reason');
    params.details = text(params.details, 'Dispute details', 10, 5000);
    if (!Number.isFinite(params.claimedAmount) || params.claimedAmount <= 0 || params.claimedAmount > order.totalAmount) throw new Error('Claim must be positive and cannot exceed the order total');

    // Freeze escrow state
    order.state = 'DISPUTED';
    order.updatedAt = new Date().toISOString();

    const disputeId = `disp_${randomUUID()}`;
    const evidenceList: EvidenceItem[] = [];

    // Automatically attach F2 Purchase Snapshot if present
    const snapshot = purchaseSnapshots.find((s) => s.orderId === order.id);
    if (snapshot) {
      evidenceList.push({
        id: `ev_snap_${snapshot.id}`,
        disputeId,
        party: 'SYSTEM',
        type: 'PURCHASE_SNAPSHOT',
        title: 'Tamper-Evident Purchase Snapshot (Baseline Evidence)',
        description: `Verified baseline snapshot captured at purchase time. Confirmation: "${snapshot.confirmationText}".`,
        sha256: snapshot.sha256,
        uploadedAt: snapshot.confirmedAt,
      });
    }

    // Fast-lane triage evaluation: clear + low value (< ₦50,000)
    const fastLaneEligible = params.claimedAmount < 50000;

    const newDispute: Dispute = {
      id: disputeId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      openedBy: params.openedBy,
      openerName: params.openerName,
      reason: params.reason,
      details: params.details,
      state: 'EVIDENCE_COLLECTION',
      claimedAmount: params.claimedAmount,
      fastLaneEligible,
      createdAt: new Date().toISOString(),
      evidence: evidenceList,
      infoRequests: [],
    };

    disputes.unshift(newDispute);

    auditLogService.log({
      actorId: params.openedBy === 'BUYER' ? order.buyerId : order.sellerId,
      actorName: params.openerName,
      actorRole: params.openedBy.toLowerCase() as any,
      action: 'DISPUTE_OPENED',
      entityType: 'DISPUTE',
      entityId: newDispute.id,
      changesSummary: `Dispute filed for Order ${order.orderNumber}. Reason: ${params.reason}. Escrow payout locked.`,
    });

    // Run AI analysis asynchronously
    await this.triggerAIAnalysis(newDispute.id);

    return newDispute;
  },

  /**
   * Runs the AI Analysis step:
   * Examines snapshot, delivery logs, uploaded evidence, inconsistency detection, and recommendation
   */
  async triggerAIAnalysis(disputeId: string): Promise<AIRecommendation | null> {
    const dispute = disputes.find((d) => d.id === disputeId);
    if (!dispute) return null;
    if (['DECIDED','CLOSED'].includes(dispute.state)) throw new Error('This dispute has already been decided');

    dispute.state = 'AI_ANALYSIS';

    const snapshot = purchaseSnapshots.find((s) => s.orderId === dispute.orderId);
    const relatedDvers = deliveryVerifications.filter((dv) => dv.orderId === dispute.orderId);

    const order = orders.find(o => o.id === dispute.orderId);
    const aiResult = await aiLayer.analyzeDisputeCase(dispute, snapshot, relatedDvers, dispute.evidence, order);

    const rec: AIRecommendation = {
      id: `ai_rec_${Date.now()}`,
      disputeId,
      modelVersion: aiResult.modelVersion,
      source: aiResult.source,
      infoRequests: aiResult.infoRequests,
      findings: aiResult.findings,
      inconsistencies: aiResult.inconsistencies,
      recommendedOutcome: aiResult.recommendedOutcome,
      confidence: aiResult.confidence,
      rationale: aiResult.rationale,
      createdAt: new Date().toISOString(),
    };

    dispute.aiRecommendation = rec;
    // Triage to Reviewer Approval (fast lane) or Reviewer Queue (standard/complex lane)
    dispute.state = dispute.fastLaneEligible ? 'REVIEWER_APPROVAL' : 'REVIEWER_QUEUE';

    auditLogService.log({
      actorId: 'ai_engine',
      actorName: 'AI Dispute Analyzer',
      actorRole: 'AI_ENGINE',
      action: 'AI_RECOMMENDATION_STORED',
      entityType: 'DISPUTE',
      entityId: dispute.id,
      changesSummary: `AI recommendation generated: ${rec.recommendedOutcome} (Confidence: ${Math.round(rec.confidence * 100)}%). Inconsistencies detected: ${rec.inconsistencies.length}.`,
    });

    return rec;
  },

  /**
   * Request clarifying information from either buyer or seller
   */
  addInfoRequest(
    disputeId: string,
    requestedFrom: 'BUYER' | 'SELLER',
    question: string
  ): InfoRequest {
    const dispute = disputes.find((d) => d.id === disputeId);
    if (!dispute) throw new Error('Dispute not found');
    if (['DECIDED','CLOSED'].includes(dispute.state)) throw new Error('This dispute has already been decided');
    choice(requestedFrom, ['BUYER','SELLER'], 'requested party');
    question = text(question, 'Question', 5, 2000);
    const dueAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString(); // 48h deadline
    const req: InfoRequest = {
      id: `info_${Date.now()}`,
      disputeId,
      requestedFrom,
      question,
      dueAt,
      createdAt: new Date().toISOString(),
      status: 'PENDING',
    };

    dispute.infoRequests.push(req);

    auditLogService.log({
      actorId: 'system_dispute_agent',
      actorName: 'Dispute Workflow',
      actorRole: 'SYSTEM',
      action: 'INFO_REQUEST_ISSUED',
      entityType: 'DISPUTE',
      entityId: dispute.id,
      changesSummary: `Information request sent to ${requestedFrom}: "${question}". Due: 48 hours.`,
    });

    return req;
  },

  /**
   * Party answers an info request
   */
  respondToInfoRequest(disputeId: string, requestId: string, responseText: string): InfoRequest {
    const dispute = disputes.find((d) => d.id === disputeId);
    if (!dispute) throw new Error('Dispute not found');

    const req = dispute.infoRequests.find((r) => r.id === requestId);
    if (!req) throw new Error('Info request not found');
    if (['DECIDED','CLOSED'].includes(dispute.state) || req.status !== 'PENDING') throw new Error('This information request is closed');
    responseText = text(responseText, 'Response', 3, 5000);
    req.response = responseText;
    req.status = 'ANSWERED';

    auditLogService.log({
      actorId: req.requestedFrom.toLowerCase(),
      actorName: `${req.requestedFrom} Response`,
      actorRole: req.requestedFrom === 'BUYER' ? 'buyer' : 'seller',
      action: 'INFO_REQUEST_ANSWERED',
      entityType: 'DISPUTE',
      entityId: dispute.id,
      changesSummary: `${req.requestedFrom} responded to information inquiry: "${responseText.substring(0, 80)}..."`,
    });

    return req;
  },

  /**
   * Human reviewer makes or approves consequential decision:
   * Triggers escrow release or refund!
   */
  decideDispute(params: {
    disputeId: string;
    reviewerId: string;
    reviewerName: string;
    decision: DisputeOutcome;
    rationale: string;
  }): Dispute {
    const dispute = disputes.find((d) => d.id === params.disputeId);
    if (!dispute) throw new Error('Dispute not found');

    const order = orders.find((o) => o.id === dispute.orderId);
    if (!order) throw new Error('Order not found');
    if (['DECIDED','CLOSED'].includes(dispute.state) || order.state !== 'DISPUTED') throw new Error('This dispute has already been settled or is not active');
    choice(params.decision, ['BUYER_REFUNDED','SELLER_PAID','SPLIT'], 'decision');
    params.rationale = text(params.rationale, 'Decision rationale', 10, 5000);
    if (!walletService.isFunded(order.id)) throw new Error('Escrow is not funded');
    dispute.state = 'DECIDED';
    dispute.decision = params.decision;
    dispute.decidedBy = params.reviewerName;
    dispute.decisionRationale = params.rationale;
    dispute.decidedAt = new Date().toISOString();

    // Consequential Escrow Execution:
    if (params.decision === 'BUYER_REFUNDED') {
      const result = orderEscrowService.releaseOrRefundEscrow(
        order.id,
        'REFUND_TO_BUYER',
        params.reviewerId,
        params.reviewerName,
        params.rationale
      );
      if (!result.success) throw new Error(result.error);
      // Record substantiated dispute on seller trust profile if seller fault
      trustService.recordTrustEvent({
        userId: order.sellerId,
        type: 'DISPUTE_SUBSTANTIATED',
        orderId: order.id,
        weight: -20,
        description: `Substantiated dispute on Order ${order.orderNumber}: ${dispute.reason}. Buyer fully refunded.`,
      });
    } else if (params.decision === 'SELLER_PAID') {
      const result = orderEscrowService.releaseOrRefundEscrow(
        order.id,
        'RELEASE_TO_SELLER',
        params.reviewerId,
        params.reviewerName,
        params.rationale
      );
      if (!result.success) throw new Error(result.error);
      // Unproven complaint on seller is excluded from lowering their score!
      trustService.recordTrustEvent({
        userId: order.sellerId,
        type: 'DISPUTE_UNPROVEN_CLEARED',
        orderId: order.id,
        weight: 0,
        description: `Unproven dispute on Order ${order.orderNumber} resolved in seller favor. Excluded from negative weighting.`,
      });
    } else {
      // SPLIT decision
      walletService.settle(order, 'SPLIT');
      order.state = 'COMPLETED';
      order.updatedAt = new Date().toISOString();
      auditLogService.log({
        actorId: params.reviewerId,
        actorName: params.reviewerName,
        actorRole: 'admin',
        action: 'CONSEQUENTIAL_ESCROW_SPLIT',
        entityType: 'ORDER',
        entityId: order.id,
        changesSummary: `Escrow funds split 50/50 between buyer and seller as decided by reviewer.`,
      });
    }

    auditLogService.log({
      actorId: params.reviewerId,
      actorName: params.reviewerName,
      actorRole: 'admin',
      action: 'DISPUTE_DECIDED',
      entityType: 'DISPUTE',
      entityId: dispute.id,
      changesSummary: `Consequential dispute ruling: ${params.decision} by Reviewer ${params.reviewerName}. Rationale: ${params.rationale}`,
    });

    return dispute;
  },
};
