import { describe, expect, it } from "vitest";
import { createRouteTestApp } from "../../../../test/http/create-test-app.js";
import { err, ok } from "../../../shared/result/index.js";
import type { AppendAuditRecordUseCase } from "../application/index.js";
import type { AuditRecord } from "../domain/index.js";

const occurredAt = new Date("2026-01-01T00:00:00.000Z");
const recordedAt = new Date("2026-01-01T00:00:01.000Z");

function createAuditRecordFixture(): AuditRecord {
  return {
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
    version: 0,
    createdAt: recordedAt,
  };
}

function createTestApp(overrides: { appendAuditRecordUseCase?: AppendAuditRecordUseCase }) {
  return createRouteTestApp({
    appendAuditRecordUseCase:
      overrides.appendAuditRecordUseCase ??
      (async () => ok({ record: createAuditRecordFixture(), idempotent: false })),
  });
}

function validAppendBody(): string {
  return JSON.stringify({
    idempotencyKey: "audit-append-1",
    actorId: "agent-1",
    action: "support-ticket.assign",
    resourceType: "SUPPORT_TICKET",
    resourceId: "ticket-1",
    result: "SUCCESS",
    reason: "assigned to support queue",
    requestId: "request-1",
    metadata: { ticketId: "ticket-1", assigneeId: "agent-1" },
    occurredAt: occurredAt.toISOString(),
  });
}

describe("audit-log routes", () => {
  it("returns 201 when audit record is appended", async () => {
    const app = createTestApp({});

    const response = await app.request("/audit-log/records", {
      method: "POST",
      body: validAppendBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid audit record body", async () => {
    const app = createTestApp({});

    const response = await app.request("/audit-log/records", {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: "audit-append-1",
        actorId: "",
        action: "support-ticket.assign",
        resourceType: "SUPPORT_TICKET",
        result: "SUCCESS",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("maps idempotency conflict to 409", async () => {
    const app = createTestApp({
      appendAuditRecordUseCase: async () =>
        err({
          type: "AuditRecordIdempotencyConflict",
          idempotencyKey: "audit-append-1",
          message: "Audit record idempotency key belongs to another command",
        }),
    });

    const response = await app.request("/audit-log/records", {
      method: "POST",
      body: validAppendBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(409);
  });
});
