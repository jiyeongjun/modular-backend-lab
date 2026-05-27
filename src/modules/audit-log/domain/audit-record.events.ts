import type { AuditMetadata, AuditResult } from "./audit-record.js";

export type AuditRecordAppendedEvent = Readonly<{
  type: "AuditRecordAppended";
  aggregateType: "AuditRecord";
  aggregateId: string;
  occurredAt: Date;
  payload: Readonly<{
    auditRecordId: string;
    idempotencyKey: string;
    actorId: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    result: AuditResult;
    reason: string | null;
    requestId: string | null;
    metadata: AuditMetadata;
    auditedAt: Date;
    recordedAt: Date;
  }>;
}>;

export type AuditRecordEvent = AuditRecordAppendedEvent;
