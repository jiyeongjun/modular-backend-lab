import { describe, expect, it } from "vitest";
import { createRouteTestApp } from "../../../../test/http/create-test-app.js";
import { err, ok } from "../../../shared/result/index.js";
import type {
  AssignSupportTicketUseCase,
  CloseSupportTicketUseCase,
  CreateSupportTicketUseCase,
} from "../application/index.js";
import type { OpenSupportTicket } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");

function createOpenTicket(): OpenSupportTicket {
  return {
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
    status: "OPEN",
    assigneeId: null,
    assignedAt: null,
    waitingAt: null,
    resolution: null,
    resolvedAt: null,
    closedAt: null,
    openedAt: now,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function createTestApp(overrides: {
  createSupportTicketUseCase?: CreateSupportTicketUseCase;
  assignSupportTicketUseCase?: AssignSupportTicketUseCase;
  closeSupportTicketUseCase?: CloseSupportTicketUseCase;
}) {
  return createRouteTestApp({
    createSupportTicketUseCase:
      overrides.createSupportTicketUseCase ??
      (async () => ok({ ticket: createOpenTicket(), idempotent: false })),
    assignSupportTicketUseCase:
      overrides.assignSupportTicketUseCase ??
      (async () =>
        ok({
          ticket: {
            ...createOpenTicket(),
            status: "ASSIGNED",
            assigneeId: "agent-1",
            assignedAt: now,
            updatedAt: now,
          },
          idempotent: false,
        })),
    closeSupportTicketUseCase:
      overrides.closeSupportTicketUseCase ??
      (async () =>
        ok({
          ticket: {
            ...createOpenTicket(),
            status: "CLOSED",
            resolution: "Resolved",
            resolvedAt: now,
            closedAt: now,
            updatedAt: now,
          },
          idempotent: false,
        })),
  });
}

function validCreateBody(): string {
  return JSON.stringify({
    customerId: "customer-1",
    idempotencyKey: "support-ticket-1",
    category: "ORDER",
    priority: "NORMAL",
    subject: "Order address change",
    description: "Customer wants to change the shipping address",
    orderId: "order-1",
  });
}

describe("support-ticket routes", () => {
  it("returns 201 when support ticket is created", async () => {
    const app = createTestApp({});

    const response = await app.request("/support/tickets", {
      method: "POST",
      body: validCreateBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid support ticket request body", async () => {
    const app = createTestApp({});

    const response = await app.request("/support/tickets", {
      method: "POST",
      body: JSON.stringify({
        customerId: "customer-1",
        idempotencyKey: "support-ticket-1",
        category: "ORDER",
        priority: "NORMAL",
        subject: "",
        description: "Customer wants to change the shipping address",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("returns 200 when support ticket is assigned", async () => {
    const app = createTestApp({});

    const response = await app.request("/support/tickets/ticket-1/assign", {
      method: "POST",
      body: JSON.stringify({ assigneeId: "agent-1" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
  });

  it("maps missing support ticket to 404", async () => {
    const app = createTestApp({
      assignSupportTicketUseCase: async () =>
        err({
          type: "SupportTicketNotFound",
          ticketId: "missing-ticket",
          message: "Support ticket was not found",
        }),
    });

    const response = await app.request("/support/tickets/missing-ticket/assign", {
      method: "POST",
      body: JSON.stringify({ assigneeId: "agent-1" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(404);
  });

  it("maps unresolved support ticket closure to 409", async () => {
    const app = createTestApp({
      closeSupportTicketUseCase: async () =>
        err({
          type: "SupportTicketNotClosable",
          status: "OPEN",
          message: "Support ticket must be resolved before closure",
        }),
    });

    const response = await app.request("/support/tickets/ticket-1/close", { method: "POST" });

    expect(response.status).toBe(409);
  });
});
