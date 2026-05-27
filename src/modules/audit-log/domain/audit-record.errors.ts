export type InvalidAuditRecordInput = Readonly<{
  type: "InvalidAuditRecordInput";
  field: "id" | "idempotencyKey" | "actorId" | "action" | "resourceType" | "occurredAt";
  message: string;
}>;

export type CreateAuditRecordError = InvalidAuditRecordInput;
