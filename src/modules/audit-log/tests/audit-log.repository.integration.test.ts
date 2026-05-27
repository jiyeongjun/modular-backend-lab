import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import { auditRecordAppendedEvent, createAuditRecord } from "../domain/index.js";
import {
  createKyselyAuditLogOutboxRepository,
  createKyselyAuditRecordRepository,
} from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const occurredAt = new Date("2026-01-01T00:00:00.000Z");
const recordedAt = new Date("2026-01-01T00:00:01.000Z");

function createAuditRecordFixture() {
  const created = createAuditRecord({
    id: "audit-1",
    idempotencyKey: "audit-append-1",
    actorId: "agent-1",
    action: "support-ticket.assign",
    resourceType: "SUPPORT_TICKET",
    resourceId: "ticket-1",
    result: "SUCCESS",
    reason: "assigned to support queue",
    requestId: "request-1",
    metadata: { ticketId: "ticket-1", assigneeId: "agent-1" },
    occurredAt,
    recordedAt,
  });
  if (!created.ok) {
    throw new Error("expected audit record to be created");
  }
  return created.value;
}

describe.runIf(dockerAvailable)("audit-log repository integration", () => {
  it("persists audit record projection, domain event, and outbox row", async () => {
    await withTestDatabase(async (db) => {
      const auditRecords = createKyselyAuditRecordRepository(db);
      const outbox = createKyselyAuditLogOutboxRepository(db);
      const record = createAuditRecordFixture();
      const events = [auditRecordAppendedEvent(record)];
      await auditRecords.create(record, events);
      await outbox.saveAll(events);

      const saved = await auditRecords.findById("audit-1");
      const idempotent = await auditRecords.findByIdempotencyKey("audit-append-1");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "AuditRecord")
        .orderBy("created_at", "asc")
        .execute();
      const outboxRows = await db
        .selectFrom("outbox_events")
        .selectAll()
        .where("aggregate_type", "=", "AuditRecord")
        .orderBy("created_at", "asc")
        .execute();

      expect(saved?.action).toBe("support-ticket.assign");
      expect(idempotent?.id).toBe("audit-1");
      expect(domainEventRows.map((row) => row.event_type)).toEqual(["AuditRecordAppended"]);
      expect(outboxRows.map((row) => row.event_type)).toEqual(["AuditRecordAppended"]);
    });
  });
});

describe.runIf(!dockerAvailable)("audit-log repository integration prerequisites", () => {
  it("documents that Docker is required for audit-log repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
