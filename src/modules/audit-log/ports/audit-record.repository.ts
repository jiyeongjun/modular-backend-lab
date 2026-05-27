import type { AuditRecord, AuditRecordEvent } from "../domain/index.js";

export type AuditRecordRepository = {
  findById(id: string): Promise<AuditRecord | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<AuditRecord | null>;
  create(record: AuditRecord, events: readonly AuditRecordEvent[]): Promise<void>;
};
