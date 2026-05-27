import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import {
  assignSupportTicket,
  closeSupportTicket,
  createSupportTicket,
  resolveSupportTicket,
  supportTicketOpenedEvent,
} from "../domain/index.js";
import {
  createKyselySupportTicketOutboxRepository,
  createKyselySupportTicketRepository,
} from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createTicketFixture() {
  const created = createSupportTicket({
    id: "ticket-1",
    customerId: "customer-1",
    idempotencyKey: "support-ticket-1",
    category: "ORDER",
    priority: "NORMAL",
    subject: "Order address change",
    description: "Customer wants to change the shipping address",
    orderId: "order-1",
    returnId: null,
    refundId: null,
    now,
  });
  if (!created.ok) {
    throw new Error("expected support ticket to be created");
  }
  return created.value;
}

describe.runIf(dockerAvailable)("support-ticket repository integration", () => {
  it("persists ticket projection, domain events, and outbox rows", async () => {
    await withTestDatabase(async (db) => {
      const tickets = createKyselySupportTicketRepository(db);
      const outbox = createKyselySupportTicketOutboxRepository(db);
      const opened = createTicketFixture();
      const openedEvents = [supportTicketOpenedEvent(opened)];
      await tickets.create(opened, openedEvents);
      await outbox.saveAll(openedEvents);

      const current = await tickets.findById("ticket-1");
      if (current === null) {
        throw new Error("expected support ticket to be loaded");
      }
      const assigned = assignSupportTicket(current, { assigneeId: "agent-1", now: later });
      if (!assigned.ok) {
        throw new Error("expected support ticket to be assigned");
      }
      await tickets.save(assigned.value.ticket, assigned.value.events);
      await outbox.saveAll(assigned.value.events);

      const assignedCurrent = await tickets.findById("ticket-1");
      if (assignedCurrent === null) {
        throw new Error("expected assigned support ticket to be loaded");
      }
      const resolved = resolveSupportTicket(assignedCurrent, {
        resolution: "Customer confirmed the new address",
        now: later,
      });
      if (!resolved.ok) {
        throw new Error("expected support ticket to be resolved");
      }
      await tickets.save(resolved.value.ticket, resolved.value.events);
      await outbox.saveAll(resolved.value.events);

      const resolvedCurrent = await tickets.findById("ticket-1");
      if (resolvedCurrent === null) {
        throw new Error("expected resolved support ticket to be loaded");
      }
      const closed = closeSupportTicket(resolvedCurrent, later);
      if (!closed.ok) {
        throw new Error("expected support ticket to be closed");
      }
      await tickets.save(closed.value.ticket, closed.value.events);
      await outbox.saveAll(closed.value.events);

      const saved = await tickets.findById("ticket-1");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "SupportTicket")
        .orderBy("created_at", "asc")
        .execute();
      const outboxRows = await db
        .selectFrom("outbox_events")
        .selectAll()
        .where("aggregate_type", "=", "SupportTicket")
        .orderBy("created_at", "asc")
        .execute();

      expect(saved?.status).toBe("CLOSED");
      expect(domainEventRows.map((row) => row.event_type)).toEqual([
        "SupportTicketOpened",
        "SupportTicketAssigned",
        "SupportTicketResolved",
        "SupportTicketClosed",
      ]);
      expect(outboxRows.map((row) => row.event_type)).toEqual([
        "SupportTicketOpened",
        "SupportTicketAssigned",
        "SupportTicketResolved",
        "SupportTicketClosed",
      ]);
    });
  });
});

describe.runIf(!dockerAvailable)("support-ticket repository integration prerequisites", () => {
  it("documents that Docker is required for support-ticket repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
