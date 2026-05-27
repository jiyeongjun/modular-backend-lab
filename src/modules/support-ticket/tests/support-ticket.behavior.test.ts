import { describe, expect, it } from "vitest";
import {
  assignSupportTicket,
  closeSupportTicket,
  createSupportTicket,
  markSupportTicketWaitingForCustomer,
  resolveSupportTicket,
  supportTicketOpenedEvent,
} from "../domain/index.js";

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

describe("support-ticket domain behavior", () => {
  it("opens a ticket with an event and normalized references", () => {
    const ticket = createTicketFixture();
    const event = supportTicketOpenedEvent(ticket);

    expect(ticket.status).toBe("OPEN");
    expect(ticket.orderId).toBe("order-1");
    expect(event.type).toBe("SupportTicketOpened");
  });

  it("assigns, waits, resolves, and closes a ticket", () => {
    const opened = createTicketFixture();
    const assigned = assignSupportTicket(opened, { assigneeId: "agent-1", now: later });
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) {
      throw new Error("expected support ticket to be assigned");
    }

    const waiting = markSupportTicketWaitingForCustomer(assigned.value.ticket, later);
    expect(waiting.ok).toBe(true);
    if (!waiting.ok) {
      throw new Error("expected support ticket to wait for customer");
    }

    const resolved = resolveSupportTicket(waiting.value.ticket, {
      resolution: "Customer confirmed the new address",
      now: later,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      throw new Error("expected support ticket to be resolved");
    }

    const closed = closeSupportTicket(resolved.value.ticket, later);
    expect(closed.ok).toBe(true);
    if (!closed.ok) {
      throw new Error("expected support ticket to be closed");
    }

    expect(closed.value.ticket.status).toBe("CLOSED");
    expect([
      assigned.value.events[0]?.type,
      waiting.value.events[0]?.type,
      resolved.value.events[0]?.type,
      closed.value.events[0]?.type,
    ]).toEqual([
      "SupportTicketAssigned",
      "SupportTicketWaitingForCustomer",
      "SupportTicketResolved",
      "SupportTicketClosed",
    ]);
  });

  it("does not close an unresolved ticket", () => {
    const opened = createTicketFixture();

    const closed = closeSupportTicket(opened, later);

    expect(closed.ok).toBe(false);
    if (closed.ok) {
      throw new Error("expected unresolved support ticket closure to fail");
    }
    expect(closed.error.type).toBe("SupportTicketNotClosable");
  });
});
