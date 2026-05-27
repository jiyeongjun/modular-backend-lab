import { describe, expect, it } from "vitest";
import { createAppendAuditRecordUseCase } from "../application/index.js";
import type { AuditRecord, AuditRecordEvent } from "../domain/index.js";
import type {
  AuditLogOutboxRepository,
  AuditLogUnitOfWork,
  AuditRecordRepository,
} from "../ports/index.js";

const occurredAt = new Date("2026-01-01T00:00:00.000Z");
const recordedAt = new Date("2026-01-01T00:00:01.000Z");

function createFakeUow(): {
  uow: AuditLogUnitOfWork;
  records: AuditRecord[];
  outboxEvents: AuditRecordEvent[];
} {
  const recordState: AuditRecord[] = [];
  const outboxEvents: AuditRecordEvent[] = [];

  function findBy(predicate: (record: AuditRecord) => boolean): AuditRecord | null {
    return recordState.find(predicate) ?? null;
  }

  const auditRecords: AuditRecordRepository = {
    findById: async (id) => findBy((record) => record.id === id),
    findByIdempotencyKey: async (idempotencyKey) =>
      findBy((record) => record.idempotencyKey === idempotencyKey),
    create: async (record) => {
      recordState.push(record);
    },
  };

  const outbox: AuditLogOutboxRepository = {
    saveAll: async (events) => {
      outboxEvents.push(...events);
    },
  };

  return {
    uow: {
      async withTransaction(work) {
        return work({ auditRecords, outbox });
      },
    },
    records: recordState,
    outboxEvents,
  };
}

function appendCommand() {
  return {
    idempotencyKey: "audit-append-1",
    actorId: "agent-1",
    action: "support-ticket.assign",
    resourceType: "SUPPORT_TICKET",
    resourceId: "ticket-1",
    result: "SUCCESS" as const,
    reason: "assigned to support queue",
    requestId: "request-1",
    metadata: { ticketId: "ticket-1", assigneeId: "agent-1" },
    occurredAt,
  };
}

describe("audit-log usecases", () => {
  it("appends audit records idempotently by idempotency key", async () => {
    const fake = createFakeUow();
    const appendAuditRecord = createAppendAuditRecordUseCase({
      uow: fake.uow,
      now: () => recordedAt,
      generateId: () => "audit-1",
    });

    const first = await appendAuditRecord(appendCommand());
    const second = await appendAuditRecord(appendCommand());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("expected audit record append to succeed");
    }
    expect(first.value.idempotent).toBe(false);
    expect(second.value.idempotent).toBe(true);
    expect(fake.records).toHaveLength(1);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual(["AuditRecordAppended"]);
  });

  it("rejects conflicting commands that reuse an idempotency key", async () => {
    const fake = createFakeUow();
    const appendAuditRecord = createAppendAuditRecordUseCase({
      uow: fake.uow,
      now: () => recordedAt,
      generateId: () => "audit-1",
    });

    await appendAuditRecord(appendCommand());
    const conflict = await appendAuditRecord({
      ...appendCommand(),
      action: "support-ticket.resolve",
    });

    expect(conflict.ok).toBe(false);
    if (conflict.ok) {
      throw new Error("expected audit record idempotency conflict");
    }
    expect(conflict.error.type).toBe("AuditRecordIdempotencyConflict");
  });
});
