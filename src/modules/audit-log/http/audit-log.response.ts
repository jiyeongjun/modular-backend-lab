import type { Result } from "../../../shared/result/index.js";
import type {
  AppendAuditRecordUseCaseError,
  AppendAuditRecordUseCaseResult,
} from "../application/index.js";
import type { AuditRecord } from "../domain/index.js";

export type AuditLogHttpResponseShape = Readonly<{
  status: 200 | 201 | 400 | 409;
  body: unknown;
}>;

export function serializeAuditRecord(record: AuditRecord): Record<string, unknown> {
  return {
    id: record.id,
    idempotencyKey: record.idempotencyKey,
    actorId: record.actorId,
    action: record.action,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    result: record.result,
    reason: record.reason,
    requestId: record.requestId,
    metadata: record.metadata,
    occurredAt: record.occurredAt.toISOString(),
    version: record.version,
    createdAt: record.createdAt.toISOString(),
  };
}

export function mapAppendAuditRecordResult(
  result: Result<AppendAuditRecordUseCaseResult, AppendAuditRecordUseCaseError>,
): AuditLogHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializeAuditRecord(result.value.record),
        idempotent: result.value.idempotent,
      },
    };
  }

  switch (result.error.type) {
    case "InvalidAuditRecordInput":
      return { status: 400, body: { error: result.error } };

    case "AuditRecordIdempotencyConflict":
      return { status: 409, body: { error: result.error } };
  }
}
