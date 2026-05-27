import { err, ok, type Result } from "../../../shared/result/index.js";
import type { CreateAuditRecordError, InvalidAuditRecordInput } from "./audit-record.errors.js";
import type { AuditRecordEvent } from "./audit-record.events.js";
import type { AuditMetadata, AuditRecord, AuditResult } from "./audit-record.js";

export type CreateAuditRecordInput = Readonly<{
  id: string;
  idempotencyKey: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  result: AuditResult;
  reason: string | null;
  requestId: string | null;
  metadata: AuditMetadata;
  occurredAt: Date;
  recordedAt: Date;
}>;

export function createAuditRecord(
  input: CreateAuditRecordInput,
): Result<AuditRecord, CreateAuditRecordError> {
  const action = input.action.trim();
  const resourceType = input.resourceType.trim();
  const invalidInput = validateRequiredFields([
    ["id", input.id],
    ["idempotencyKey", input.idempotencyKey],
    ["actorId", input.actorId],
    ["action", action],
    ["resourceType", resourceType],
  ]);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  if (Number.isNaN(input.occurredAt.getTime())) {
    return err({
      type: "InvalidAuditRecordInput",
      field: "occurredAt",
      message: "Audit record occurredAt must be a valid date",
    });
  }

  return ok({
    id: input.id.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
    actorId: input.actorId.trim(),
    action,
    resourceType,
    resourceId: normalizeNullable(input.resourceId),
    result: input.result,
    reason: normalizeNullable(input.reason),
    requestId: normalizeNullable(input.requestId),
    metadata: input.metadata,
    occurredAt: input.occurredAt,
    version: 0,
    createdAt: input.recordedAt,
  });
}

export function auditRecordAppendedEvent(record: AuditRecord): AuditRecordEvent {
  return {
    type: "AuditRecordAppended",
    aggregateType: "AuditRecord",
    aggregateId: record.id,
    occurredAt: record.createdAt,
    payload: {
      auditRecordId: record.id,
      idempotencyKey: record.idempotencyKey,
      actorId: record.actorId,
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      result: record.result,
      reason: record.reason,
      requestId: record.requestId,
      metadata: record.metadata,
      auditedAt: record.occurredAt,
      recordedAt: record.createdAt,
    },
  };
}

function normalizeNullable(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function validateRequiredFields(
  entries: readonly (readonly [InvalidAuditRecordInput["field"], string])[],
): InvalidAuditRecordInput | null {
  for (const [field, value] of entries) {
    if (value.trim().length === 0) {
      return {
        type: "InvalidAuditRecordInput",
        field,
        message: `Audit record ${field} is required`,
      };
    }
  }

  return null;
}
