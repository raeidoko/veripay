import {
  RiskAssessment,
  RiskLevel,
  IdentityAttribute,
  IdentityLink,
  IdentityAttributeType,
} from '../../shared/types.ts';
import {
  riskAssessments,
  identityAttributes,
  identityLinks,
  users,
  orders,
  dispatchContacts,
} from '../db/store.ts';
import { hashSaltedAttribute } from '../utils/crypto.ts';
import { auditLogService } from './auditLogService.ts';
import { walletService } from './walletService.ts';
import { choice, text } from '../utils/validation.ts';

export const riskService = {
  getAssessments(): RiskAssessment[] {
    return [...riskAssessments].reverse();
  },

  getIdentityLinks(): IdentityLink[] {
    return [...identityLinks].reverse();
  },

  getIdentityAttributes(userId: string): IdentityAttribute[] {
    return identityAttributes.filter((a) => a.userId === userId);
  },

  /**
   * Register salted identity attribute for an account
   */
  registerAttribute(userId: string, type: IdentityAttributeType, rawValue: string): IdentityAttribute {
    const rawHint = type === 'PHONE'
      ? rawValue.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
      : `${type}_${rawValue.substring(0, 4)}***`;
    const hashedValue = hashSaltedAttribute(rawValue);

    const attr: IdentityAttribute = {
      id: `attr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      type,
      rawHint,
      hashedValue,
      createdAt: new Date().toISOString(),
    };

    identityAttributes.push(attr);

    // Cross-match against restricted accounts!
    this.detectLinkedIdentities(userId, attr);

    return attr;
  },

  /**
   * Linked Identity Detection:
   * Compares salted hash with restricted or watchlisted users
   */
  detectLinkedIdentities(userId: string, newAttr: IdentityAttribute): IdentityLink | null {
    const restrictedUsers = users.filter((u) => u.isRestricted && u.id !== userId);

    for (const rUser of restrictedUsers) {
      const matchingAttrs = identityAttributes.filter(
        (a) => a.userId === rUser.id && a.type === newAttr.type && a.hashedValue === newAttr.hashedValue
      );

      if (matchingAttrs.length > 0) {
        const currentUser = users.find((u) => u.id === userId);
        const link: IdentityLink = {
          id: `idlink_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userA: rUser.id,
          userB: userId,
          userAName: rUser.name,
          userBName: currentUser ? currentUser.name : 'Suspect User',
          matchedAttribute: newAttr.type,
          matchDetails: `Cryptographic salted hash collision on ${newAttr.type} (${newAttr.rawHint}) with watchlist account ${rUser.name}.`,
          status: 'SUSPECTED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        identityLinks.unshift(link);

        auditLogService.log({
          actorId: 'system_risk_engine',
          actorName: 'Intelligent Risk Shield',
          actorRole: 'SYSTEM',
          action: 'IDENTITY_LINK_SUSPECTED',
          entityType: 'RISK',
          entityId: link.id,
          changesSummary: `Suspected multi-account link discovered: ${link.userBName} shares ${newAttr.type} with restricted account ${link.userAName}.`,
        });

        return link;
      }
    }

    return null;
  },

  /**
   * Internal risk assessment called on order creation, dispatch, or account events
   */
  assessOrder(orderId: string): RiskAssessment {
    const order = orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');

    const reasons: string[] = [];
    let riskScore = 15; // baseline

    // Signal 1: High transaction value for newer account
    if (order.totalAmount > 2000000) {
      riskScore += 25;
      reasons.push(`High order value (₦${order.totalAmount.toLocaleString()}) exceeding tier threshold.`);
    }

    // Signal 2: Check buyer linked identities
    const buyerLinks = identityLinks.filter(
      (l) => (l.userA === order.buyerId || l.userB === order.buyerId) && l.status !== 'CLEARED'
    );
    if (buyerLinks.length > 0) {
      riskScore += 45;
      reasons.push(
        `Buyer linked to flagged account (${buyerLinks[0].matchDetails}). Escalated to watchlist screening.`
      );
    }

    // Signal 3: Dispatch contact anomaly check (e.g. rider reused across multiple sellers)
    if (order.dispatchContactId) {
      const contact = dispatchContacts.find((c) => c.id === order.dispatchContactId);
      if (contact) {
        const otherSellerOrders = orders.filter(
          (o) => o.sellerId !== order.sellerId && o.dispatchContactId
        );
        const reusedCount = otherSellerOrders.filter((o) => {
          const c = dispatchContacts.find((dc) => dc.id === o.dispatchContactId);
          return c && c.phone === contact.phone;
        }).length;

        if (reusedCount >= 3) {
          riskScore += 30;
          reasons.push(`Dispatch rider phone (${contact.phone}) reused across ${reusedCount} unrelated sellers.`);
        }
      }
    }

    // Determine risk level
    let level: RiskLevel = 'LOW';
    if (riskScore >= 75) {
      level = 'HIGH';
    } else if (riskScore >= 40) {
      level = 'MEDIUM';
    }

    // Action according to risk architecture:
    // High: Hold transaction and escalate to human review
    if (level === 'HIGH') {
      if (order.state !== 'AWAITING_CONFIRMATION') order.state = 'RISK_HOLD';
      order.hasRiskFlag = true;
      order.riskLevel = level;
    }

    const assessment: RiskAssessment = {
      id: `risk_${order.id}_${Date.now()}`,
      subjectType: 'ORDER',
      subjectId: order.id,
      score: Math.min(99, riskScore),
      level,
      reasons: reasons.length > 0 ? reasons : ['Normal transaction profile, verified escrow counterparties.'],
      modelVersion: 'veripay-risk-shield-v4',
      createdAt: new Date().toISOString(),
      state: level === 'HIGH' ? 'HELD' : 'ACTIVE',
      assignedReviewer: 'user_admin_1',
    };

    riskAssessments.unshift(assessment);

    auditLogService.log({
      actorId: 'system_risk_engine',
      actorName: 'VeriPay Risk Service',
      actorRole: 'SYSTEM',
      action: 'RISK_ASSESSMENT_COMPLETED',
      entityType: 'RISK',
      entityId: assessment.id,
      changesSummary: `Risk assessment for Order ${order.orderNumber}: Score=${assessment.score}, Level=${assessment.level}. Reasons: ${assessment.reasons.join('; ')}`,
    });

    return assessment;
  },

  /**
   * Human reviewer resolves risk assessment
   */
  resolveAssessment(
    assessmentId: string,
    reviewerId: string,
    reviewerName: string,
    action: 'RELEASE_HOLD' | 'CONFIRM_RESTRICTION' | 'CLEAR_FLAG',
    resolutionNotes: string
  ): RiskAssessment {
    const assessment = riskAssessments.find((a) => a.id === assessmentId);
    if (!assessment) throw new Error('Risk assessment not found');
    choice(action, ['RELEASE_HOLD','CONFIRM_RESTRICTION','CLEAR_FLAG'], 'risk action');
    resolutionNotes = text(resolutionNotes, 'Resolution notes', 3, 2000);
    if (['CLEARED','RESTRICTED'].includes(assessment.state)) throw new Error('This assessment has already been resolved');
    const targetOrder = assessment.subjectType === 'ORDER' ? orders.find(order => order.id === assessment.subjectId) : undefined;
    if (targetOrder && ['COMPLETED','REFUNDED','CANCELLED','DISPUTED'].includes(targetOrder.state) && action !== 'CLEAR_FLAG') throw new Error('Resolve active disputes through the dispute workflow; settled orders cannot be changed');

    assessment.assignedReviewer = reviewerId;
    assessment.resolutionNotes = resolutionNotes;

    if (action === 'RELEASE_HOLD') {
      assessment.state = 'CLEARED';
      assessment.level = 'LOW';
      if (assessment.subjectType === 'ORDER') {
        const order = orders.find((o) => o.id === assessment.subjectId);
        if (order && order.state === 'RISK_HOLD') {
          order.state = walletService.isFunded(order.id) ? 'PAYMENT_SECURED' : order.purchaseSnapshotId ? 'PENDING_PAYMENT' : 'AWAITING_CONFIRMATION';
          order.hasRiskFlag = false;
          order.riskLevel = 'LOW';
        }
      }
    } else if (action === 'CONFIRM_RESTRICTION') {
      assessment.state = 'RESTRICTED';
      assessment.level = 'CONFIRMED';
      if (assessment.subjectType === 'ORDER') {
        const order = orders.find((o) => o.id === assessment.subjectId);
        if (order) {
          if (walletService.isFunded(order.id)) { walletService.settle(order, 'BUYER_REFUNDED'); order.state = 'REFUNDED'; }
          else order.state = 'CANCELLED';
          const buyer = users.find((u) => u.id === order.buyerId);
          if (buyer) {
            buyer.isRestricted = true;
            buyer.restrictionReason = `Confirmed fraudulent link or severe risk anomaly: ${resolutionNotes}`;
          }
        }
      }
    } else if (action === 'CLEAR_FLAG') {
      if (assessment.state === 'HELD') throw new Error('Use release hold or confirm restriction for a held order');
      assessment.state = 'CLEARED';
    }

    auditLogService.log({
      actorId: reviewerId,
      actorName: reviewerName,
      actorRole: 'admin',
      action: 'RISK_ASSESSMENT_RESOLVED',
      entityType: 'RISK',
      entityId: assessment.id,
      changesSummary: `Reviewer resolved risk assessment [${assessmentId}] with action: ${action}. Notes: ${resolutionNotes}`,
    });

    return assessment;
  },

  /**
   * Reviewer confirms or clears identity link
   */
  updateIdentityLink(
    linkId: string,
    reviewerId: string,
    status: 'CONFIRMED' | 'CLEARED',
    reviewerName: string
  ): IdentityLink {
    const link = identityLinks.find((l) => l.id === linkId);
    if (!link) throw new Error('Identity link not found');
    choice(status, ['CONFIRMED','CLEARED'], 'identity link status');
    if (link.status !== 'SUSPECTED') throw new Error('This identity link has already been reviewed');

    link.status = status;
    link.reviewedBy = reviewerId;
    link.updatedAt = new Date().toISOString();

    if (status === 'CONFIRMED') {
      // Apply account restriction to the secondary account
      const userB = users.find((u) => u.id === link.userB);
      if (userB) {
        userB.isRestricted = true;
        userB.restrictionReason = `Confirmed association with restricted entity (${link.userAName}) via matched ${link.matchedAttribute}.`;
      }
    }

    auditLogService.log({
      actorId: reviewerId,
      actorName: reviewerName,
      actorRole: 'admin',
      action: 'IDENTITY_LINK_DECIDED',
      entityType: 'RISK',
      entityId: link.id,
      changesSummary: `Reviewer set identity link between ${link.userAName} and ${link.userBName} to ${status}.`,
    });

    return link;
  },
};
