import { describe, expect, it } from "vitest";
import { auditRecordAppendedEvent, createAuditRecord } from "../domain/index.js";

const occurredAt = new Date("2026-01-01T00:00:00.000Z");
const recordedAt = new Date("2026-01-01T00:00:01.000Z");

function createRecordFixture() {
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

describe("audit-log domain behavior", () => {
  it("creates immutable audit records with normalized fields", () => {
    const record = createRecordFixture();

    expect(record.actorId).toBe("agent-1");
    expect(record.result).toBe("SUCCESS");
    expect(record.version).toBe(0);
  });

  it("creates an append event for the audit record", () => {
    const record = createRecordFixture();

    const event = auditRecordAppendedEvent(record);

    expect(event.type).toBe("AuditRecordAppended");
    expect(event.aggregateType).toBe("AuditRecord");
    expect(event.payload.auditedAt).toEqual(occurredAt);
    expect(event.payload.recordedAt).toEqual(recordedAt);
  });

  it("rejects records without an actor", () => {
    const created = createAuditRecord({
      id: "audit-1",
      idempotencyKey: "audit-append-1",
      actorId: "",
      action: "support-ticket.assign",
      resourceType: "SUPPORT_TICKET",
      resourceId: "ticket-1",
      result: "SUCCESS",
      reason: null,
      requestId: null,
      metadata: {},
      occurredAt,
      recordedAt,
    });

    expect(created.ok).toBe(false);
    if (created.ok) {
      throw new Error("expected invalid audit record to fail");
    }
    expect(created.error.type).toBe("InvalidAuditRecordInput");
    expect(created.error.field).toBe("actorId");
  });
});
