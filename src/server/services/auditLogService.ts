import { AuditLogEntry, UserRole } from '../../shared/types.ts';
import { auditLogs } from '../db/store.ts';
import { calculateSha256 } from '../utils/crypto.ts';

export const auditLogService = {
  getLogs(): AuditLogEntry[] {
    return [...auditLogs].reverse(); // newest first
  },

  log(params: {
    actorId: string;
    actorName: string;
    actorRole: UserRole | 'SYSTEM' | 'AI_ENGINE';
    action: string;
    entityType: AuditLogEntry['entityType'];
    entityId: string;
    changesSummary: string;
  }): AuditLogEntry {
    const previousHash = auditLogs.length > 0 ? auditLogs[auditLogs.length - 1].sha256Hash : 'genesis_root';
    const timestamp = new Date().toISOString();
    const entryId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const hashPayload = {
      id: entryId,
      timestamp,
      previousHash,
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      changesSummary: params.changesSummary,
    };

    const entry: AuditLogEntry = {
      id: entryId,
      timestamp,
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      changesSummary: params.changesSummary,
      sha256Hash: calculateSha256(hashPayload),
    };

    auditLogs.push(entry);
    return entry;
  },
};
