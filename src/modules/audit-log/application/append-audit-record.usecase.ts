import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type AuditMetadata,
  type AuditRecord,
  type AuditResult,
  auditRecordAppendedEvent,
  type CreateAuditRecordError,
  createAuditRecord,
} from "../domain/index.js";
import type { AuditLogUnitOfWork } from "../ports/index.js";

export type AppendAuditRecordCommand = Readonly<{
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
}>;

export type AppendAuditRecordUseCaseError =
  | CreateAuditRecordError
  | {
      type: "AuditRecordIdempotencyConflict";
      idempotencyKey: string;
      message: string;
    };

export type AppendAuditRecordUseCaseResult = Readonly<{
  record: AuditRecord;
  idempotent: boolean;
}>;

export type AppendAuditRecordUseCase = (
  command: AppendAuditRecordCommand,
) => Promise<Result<AppendAuditRecordUseCaseResult, AppendAuditRecordUseCaseError>>;

export function createAppendAuditRecordUseCase(deps: {
  uow: AuditLogUnitOfWork;
  now: () => Date;
  generateId: () => string;
}): AppendAuditRecordUseCase {
  return async function appendAuditRecordUseCase(command) {
    return deps.uow.withTransaction<AppendAuditRecordUseCaseResult, AppendAuditRecordUseCaseError>(
      async ({ auditRecords, outbox }) => {
        const existing = await auditRecords.findByIdempotencyKey(command.idempotencyKey);
        if (existing !== null) {
          if (!sameAppendCommand(existing, command)) {
            return err({
              type: "AuditRecordIdempotencyConflict",
              idempotencyKey: command.idempotencyKey,
              message: "Audit record idempotency key belongs to another command",
            });
          }

          return ok({ record: existing, idempotent: true });
        }

        const created = createAuditRecord({
          id: deps.generateId(),
          idempotencyKey: command.idempotencyKey,
          actorId: command.actorId,
          action: command.action,
          resourceType: command.resourceType,
          resourceId: command.resourceId,
          result: command.result,
          reason: command.reason,
          requestId: command.requestId,
          metadata: command.metadata,
          occurredAt: command.occurredAt,
          recordedAt: deps.now(),
        });
        if (!created.ok) {
          return err(created.error);
        }

        const events = [auditRecordAppendedEvent(created.value)];
        await auditRecords.create(created.value, events);
        await outbox.saveAll(events);

        return ok({ record: created.value, idempotent: false });
      },
    );
  };
}

function sameAppendCommand(record: AuditRecord, command: AppendAuditRecordCommand): boolean {
  return (
    record.actorId === command.actorId.trim() &&
    record.action === command.action.trim() &&
    record.resourceType === command.resourceType.trim() &&
    record.resourceId === normalizeNullable(command.resourceId) &&
    record.result === command.result &&
    record.reason === normalizeNullable(command.reason) &&
    record.requestId === normalizeNullable(command.requestId) &&
    record.occurredAt.getTime() === command.occurredAt.getTime() &&
    sameMetadata(record.metadata, command.metadata)
  );
}

function normalizeNullable(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function sameMetadata(left: AuditMetadata, right: AuditMetadata): boolean {
  const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );
  const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every(([key, value], index) => {
    const rightEntry = rightEntries[index];
    return rightEntry !== undefined && rightEntry[0] === key && rightEntry[1] === value;
  });
}
