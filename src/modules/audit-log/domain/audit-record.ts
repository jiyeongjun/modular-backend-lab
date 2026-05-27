export type AuditResult = "SUCCESS" | "DENIED" | "FAILED";

export type AuditMetadataValue = string | number | boolean | null;

export type AuditMetadata = Readonly<Record<string, AuditMetadataValue>>;

export type AuditRecord = Readonly<{
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
  version: number;
  createdAt: Date;
}>;
