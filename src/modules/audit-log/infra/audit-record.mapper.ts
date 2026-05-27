import type { AuditLogRecordInsert, AuditLogRecordRow } from "../../../infra/db/database.js";
import type {
  AuditMetadata,
  AuditMetadataValue,
  AuditRecord,
  AuditResult,
} from "../domain/index.js";

function toResult(value: string): AuditResult {
  switch (value) {
    case "SUCCESS":
    case "DENIED":
    case "FAILED":
      return value;
  }

  throw new Error(`Unknown audit result: ${value}`);
}

function isMetadataValue(value: unknown): value is AuditMetadataValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  );
}

function toMetadata(value: unknown): AuditMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Audit metadata must be a JSON object");
  }

  const metadata: Record<string, AuditMetadataValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isMetadataValue(entry)) {
      throw new Error("Audit metadata values must be primitive JSON values");
    }
    metadata[key] = entry;
  }

  return metadata;
}

export function toAuditRecord(row: AuditLogRecordRow): AuditRecord {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    actorId: row.actor_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    result: toResult(row.result),
    reason: row.reason,
    requestId: row.request_id,
    metadata: toMetadata(row.metadata),
    occurredAt: row.occurred_at,
    version: row.version,
    createdAt: row.created_at,
  };
}

export function toAuditRecordInsert(record: AuditRecord): AuditLogRecordInsert {
  return {
    id: record.id,
    idempotency_key: record.idempotencyKey,
    actor_id: record.actorId,
    action: record.action,
    resource_type: record.resourceType,
    resource_id: record.resourceId,
    result: record.result,
    reason: record.reason,
    request_id: record.requestId,
    metadata: JSON.stringify(record.metadata),
    occurred_at: record.occurredAt,
    version: record.version,
    created_at: record.createdAt,
  };
}
