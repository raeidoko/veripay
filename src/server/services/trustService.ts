import {
  TrustProfile,
  TrustEvent,
  TrustChallenge,
  TrustPassportLevel,
} from '../../shared/types.ts';
import { trustProfiles, trustEvents, trustChallenges, users } from '../db/store.ts';
import { auditLogService } from './auditLogService.ts';
import { choice, text } from '../utils/validation.ts';

export const trustService = {
  getProfile(userId: string): TrustProfile {
    if (!trustProfiles[userId]) {
      const user = users.find((u) => u.id === userId);
      trustProfiles[userId] = {
        userId,
        userName: user ? user.name : 'VeriPay User',
        level: 'BRONZE',
        reliabilityScore: 50,
        factors: {
          verifiedTransactions: 0,
          onTimeDeliveryRate: 100,
          cooperationScore: 100,
          substantiatedDisputes: 0,
          unprovenComplaintsExcluded: 0,
          accountAgeDays: 1,
          dispatchVerifiedCount: 0,
        },
        updatedAt: new Date().toISOString(),
        identityVerified: user ? user.identityVerified : false,
        identityCheckMethod: user?.identityMethods.join(' + ') || 'Unverified',
      };
    }
    return trustProfiles[userId];
  },

  getAllProfiles(): TrustProfile[] {
    return Object.values(trustProfiles);
  },

  getUserEvents(userId: string): TrustEvent[] {
    return trustEvents.filter((e) => e.userId === userId);
  },

  getChallenges(userId?: string): TrustChallenge[] {
    if (userId) {
      return trustChallenges.filter((c) => c.userId === userId);
    }
    return trustChallenges;
  },

  recordTrustEvent(params: {
    userId: string;
    type: 'TRANSACTION_COMPLETED' | 'DELIVERY_VERIFIED' | 'DISPUTE_SUBSTANTIATED' | 'DISPUTE_UNPROVEN_CLEARED' | 'COOPERATION_RECORD';
    orderId?: string;
    weight: number;
    description: string;
  }): TrustEvent {
    const event: TrustEvent = {
      id: `te_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: params.userId,
      type: params.type,
      orderId: params.orderId,
      weight: params.weight,
      verified: true,
      status: 'ACTIVE',
      description: params.description,
      timestamp: new Date().toISOString(),
    };

    trustEvents.unshift(event);
    this.recalculateProfile(params.userId);

    auditLogService.log({
      actorId: 'system_trust_engine',
      actorName: 'Trust Passport Engine',
      actorRole: 'SYSTEM',
      action: 'TRUST_EVENT_RECORDED',
      entityType: 'TRUST',
      entityId: event.id,
      changesSummary: `Trust event [${event.type}] recorded for user ${params.userId}. Weight: ${event.weight}`,
    });

    return event;
  },

  recalculateProfile(userId: string): TrustProfile {
    const profile = this.getProfile(userId);
    // Only ACTIVE events count towards score; UNDER_REVIEW and REVOKED are strictly excluded!
    const activeEvents = trustEvents.filter((e) => e.userId === userId && e.status === 'ACTIVE');

    let verifiedTxCount = 0;
    let substantiatedDisputes = 0;
    let unprovenDisputes = 0;
    let dispatchVerifications = 0;
    let positiveWeight = 0;
    let negativeWeight = 0;

    for (const ev of activeEvents) {
      if (ev.type === 'TRANSACTION_COMPLETED') {
        verifiedTxCount++;
        positiveWeight += ev.weight;
      } else if (ev.type === 'DELIVERY_VERIFIED') {
        dispatchVerifications++;
        positiveWeight += ev.weight;
      } else if (ev.type === 'DISPUTE_SUBSTANTIATED') {
        substantiatedDisputes++;
        negativeWeight += Math.abs(ev.weight);
      } else if (ev.type === 'DISPUTE_UNPROVEN_CLEARED') {
        unprovenDisputes++;
      } else if (ev.type === 'COOPERATION_RECORD') {
        positiveWeight += ev.weight;
      }
    }

    // Dynamic scoring formula: baseline + positive contributions minus heavy penalty for substantiated fraud/disputes
    // Unproven complaints NEVER reduce the reliability score!
    let rawScore = 80 + Math.min(20, positiveWeight * 0.5) - substantiatedDisputes * 25;
    if (verifiedTxCount === 0) rawScore = 65; // New accounts baseline
    const reliabilityScore = Math.max(5, Math.min(99, Math.round(rawScore)));

    // Progressive level criteria: requires sustained reliability AND verified outcome count
    // Volume alone can NEVER raise a level!
    let level: TrustPassportLevel = 'BRONZE';
    if (verifiedTxCount >= 10 && reliabilityScore >= 80 && substantiatedDisputes === 0) {
      level = 'SILVER';
    }
    if (verifiedTxCount >= 25 && reliabilityScore >= 90 && substantiatedDisputes <= 1) {
      level = 'GOLD';
    }
    if (verifiedTxCount >= 50 && reliabilityScore >= 95 && substantiatedDisputes === 0 && profile.identityVerified) {
      level = 'CROWN';
    }

    profile.level = level;
    profile.reliabilityScore = reliabilityScore;
    profile.factors = {
      ...profile.factors,
      verifiedTransactions: verifiedTxCount || profile.factors.verifiedTransactions,
      dispatchVerifiedCount: dispatchVerifications || profile.factors.dispatchVerifiedCount,
      substantiatedDisputes,
      unprovenComplaintsExcluded: unprovenDisputes,
      cooperationScore: Math.max(70, Math.min(100, 100 - substantiatedDisputes * 10)),
      onTimeDeliveryRate: substantiatedDisputes > 0 ? 92 : 99,
    };
    profile.updatedAt = new Date().toISOString();

    return profile;
  },

  /**
   * User contests an inaccurate record
   * Immediately marks event UNDER_REVIEW and excludes from scoring
   */
  challengeEvent(eventId: string, userId: string, userName: string, reason: string): TrustChallenge {
    const event = trustEvents.find((e) => e.id === eventId);
    if (!event) throw new Error('Trust event not found');
    if (event.userId !== userId) throw new Error('This trust event belongs to another account');
    if (event.status !== 'ACTIVE') throw new Error('This trust event is already under review or revoked');
    reason = text(reason, 'Challenge reason', 10, 2000);

    event.status = 'UNDER_REVIEW'; // Excluded from score calculation immediately!

    const challenge: TrustChallenge = {
      id: `chal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      eventId,
      userId,
      userName,
      reason,
      state: 'UNDER_REVIEW',
      createdAt: new Date().toISOString(),
    };

    trustChallenges.push(challenge);
    this.recalculateProfile(userId);

    auditLogService.log({
      actorId: userId,
      actorName: userName,
      actorRole: 'seller',
      action: 'TRUST_RECORD_CHALLENGED',
      entityType: 'TRUST',
      entityId: challenge.id,
      changesSummary: `User challenged trust event ${eventId}. Event marked UNDER_REVIEW and excluded from reliability calculations.`,
    });

    return challenge;
  },

  /**
   * Reviewer decides on challenge
   */
  resolveChallenge(
    challengeId: string,
    reviewerId: string,
    decision: 'RESOLVED_REMOVED' | 'RESOLVED_UPHELD',
    decisionNotes: string
  ): TrustChallenge {
    const challenge = trustChallenges.find((c) => c.id === challengeId);
    if (!challenge) throw new Error('Challenge not found');
    if (challenge.state !== 'UNDER_REVIEW') throw new Error('This challenge has already been decided');
    choice(decision, ['RESOLVED_REMOVED','RESOLVED_UPHELD'], 'challenge decision');
    decisionNotes = text(decisionNotes, 'Decision notes', 3, 2000);

    const event = trustEvents.find((e) => e.id === challenge.eventId);

    challenge.state = decision;
    challenge.decidedBy = reviewerId;
    challenge.decisionNotes = decisionNotes;

    if (event) {
      if (decision === 'RESOLVED_REMOVED') {
        event.status = 'REVOKED';
      } else {
        event.status = 'ACTIVE';
      }
    }

    this.recalculateProfile(challenge.userId);

    auditLogService.log({
      actorId: reviewerId,
      actorName: 'Reviewer',
      actorRole: 'admin',
      action: 'TRUST_CHALLENGE_RESOLVED',
      entityType: 'TRUST',
      entityId: challenge.id,
      changesSummary: `Challenge decided as ${decision}. Notes: ${decisionNotes}`,
    });

    return challenge;
  },
};
