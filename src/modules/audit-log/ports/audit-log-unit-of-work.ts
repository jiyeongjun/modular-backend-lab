import type { Result } from "../../../shared/result/index.js";
import type { AuditLogOutboxRepository } from "./audit-log-outbox.repository.js";
import type { AuditRecordRepository } from "./audit-record.repository.js";

export type AuditLogUnitOfWorkContext = Readonly<{
  auditRecords: AuditRecordRepository;
  outbox: AuditLogOutboxRepository;
}>;

export type AuditLogUnitOfWork = {
  withTransaction<TValue, TError>(
    work: (context: AuditLogUnitOfWorkContext) => Promise<Result<TValue, TError>>,
  ): Promise<Result<TValue, TError>>;
};
