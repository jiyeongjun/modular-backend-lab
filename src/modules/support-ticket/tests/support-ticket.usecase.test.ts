import { describe, expect, it } from "vitest";
import {
  createAssignSupportTicketUseCase,
  createCloseSupportTicketUseCase,
  createCreateSupportTicketUseCase,
  createMarkSupportTicketWaitingUseCase,
  createResolveSupportTicketUseCase,
} from "../application/index.js";
import type { SupportTicket, SupportTicketEvent } from "../domain/index.js";
import type {
  SupportTicketOutboxRepository,
  SupportTicketRepository,
  SupportTicketUnitOfWork,
} from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createFakeUow(): {
  uow: SupportTicketUnitOfWork;
  tickets: SupportTicket[];
  outboxEvents: SupportTicketEvent[];
} {
  const ticketState: SupportTicket[] = [];
  const outboxEvents: SupportTicketEvent[] = [];

  function findBy(predicate: (ticket: SupportTicket) => boolean): SupportTicket | null {
    return ticketState.find(predicate) ?? null;
  }

  const tickets: SupportTicketRepository = {
    findById: async (id) => findBy((ticket) => ticket.id === id),
    findByIdForUpdate: async (id) => findBy((ticket) => ticket.id === id),
    findByIdempotencyKey: async (idempotencyKey) =>
      findBy((ticket) => ticket.idempotencyKey === idempotencyKey),
    create: async (ticket) => {
      ticketState.push(ticket);
    },
    save: async (ticket) => {
      const index = ticketState.findIndex((current) => current.id === ticket.id);
      if (index === -1) {
        throw new Error("support ticket missing");
      }
      ticketState[index] = ticket;
    },
  };

  const outbox: SupportTicketOutboxRepository = {
    saveAll: async (events) => {
      outboxEvents.push(...events);
    },
  };

  return {
    uow: {
      async withTransaction(work) {
        return work({ tickets, outbox });
      },
    },
    tickets: ticketState,
    outboxEvents,
  };
}

function createCommand() {
  return {
    customerId: "customer-1",
    idempotencyKey: "support-ticket-1",
    category: "ORDER" as const,
    priority: "NORMAL" as const,
    subject: "Order address change",
    description: "Customer wants to change the shipping address",
    orderId: "order-1",
    returnId: null,
    refundId: null,
  };
}

describe("support-ticket usecases", () => {
  it("creates support tickets idempotently by idempotency key", async () => {
    const fake = createFakeUow();
    const createTicket = createCreateSupportTicketUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "ticket-1",
    });

    const first = await createTicket(createCommand());
    const second = await createTicket(createCommand());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("expected support ticket creation to succeed");
    }
    expect(first.value.idempotent).toBe(false);
    expect(second.value.idempotent).toBe(true);
    expect(fake.tickets).toHaveLength(1);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual(["SupportTicketOpened"]);
  });

  it("assigns, waits, resolves, and closes a support ticket", async () => {
    const fake = createFakeUow();
    const createTicket = createCreateSupportTicketUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "ticket-1",
    });
    const assign = createAssignSupportTicketUseCase({ uow: fake.uow, now: () => later });
    const wait = createMarkSupportTicketWaitingUseCase({ uow: fake.uow, now: () => later });
    const resolve = createResolveSupportTicketUseCase({ uow: fake.uow, now: () => later });
    const close = createCloseSupportTicketUseCase({ uow: fake.uow, now: () => later });

    await createTicket(createCommand());
    const assigned = await assign({ ticketId: "ticket-1", assigneeId: "agent-1" });
    const waiting = await wait({ ticketId: "ticket-1" });
    const resolved = await resolve({
      ticketId: "ticket-1",
      resolution: "Customer confirmed the new address",
    });
    const closed = await close({ ticketId: "ticket-1" });

    expect(assigned.ok).toBe(true);
    expect(waiting.ok).toBe(true);
    expect(resolved.ok).toBe(true);
    expect(closed.ok).toBe(true);
    expect(fake.tickets[0]?.status).toBe("CLOSED");
    expect(fake.outboxEvents.map((event) => event.type)).toEqual([
      "SupportTicketOpened",
      "SupportTicketAssigned",
      "SupportTicketWaitingForCustomer",
      "SupportTicketResolved",
      "SupportTicketClosed",
    ]);
  });

  it("keeps closure rule in the application boundary", async () => {
    const fake = createFakeUow();
    const createTicket = createCreateSupportTicketUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "ticket-1",
    });
    const close = createCloseSupportTicketUseCase({ uow: fake.uow, now: () => later });

    await createTicket(createCommand());
    const result = await close({ ticketId: "ticket-1" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected unresolved support ticket closure to fail");
    }
    expect(result.error.type).toBe("SupportTicketNotClosable");
  });
});
