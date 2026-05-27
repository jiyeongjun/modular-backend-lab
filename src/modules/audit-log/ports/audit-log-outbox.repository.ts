import type { AuditRecordEvent } from "../domain/index.js";

export type AuditLogOutboxRepository = {
  saveAll(events: readonly AuditRecordEvent[]): Promise<void>;
};
