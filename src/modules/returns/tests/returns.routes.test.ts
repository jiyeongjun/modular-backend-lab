import { describe, expect, it } from "vitest";
import { createRouteTestApp } from "../../../../test/http/create-test-app.js";
import { err, ok } from "../../../shared/result/index.js";
import type {
  AuthorizeReturnUseCase,
  CreateReturnRequestUseCase,
  InspectReturnUseCase,
  ReceiveReturnUseCase,
} from "../application/index.js";
import type {
  ApprovedReturnRequest,
  AuthorizedReturnRequest,
  ReceivedReturnRequest,
  RequestedReturnRequest,
} from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");
const receivedAt = new Date("2026-01-02T00:00:00.000Z");
const inspectedAt = new Date("2026-01-02T01:00:00.000Z");

function createRequestedReturn(): RequestedReturnRequest {
  return {
    id: "return-1",
    orderId: "order-1",
    fulfillmentId: "fulfillment-1",
    idempotencyKey: "return-request-1",
    reason: "wrong size",
    items: [{ sku: "sku-1", quantity: 2 }],
    status: "REQUESTED",
    rmaNumber: null,
    requestedAt: now,
    authorizedAt: null,
    receivedAt: null,
    inspectedAt: null,
    restockableItems: null,
    inspectionNote: null,
    rejectionReason: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function createAuthorizedReturn(): AuthorizedReturnRequest {
  return {
    ...createRequestedReturn(),
    status: "AUTHORIZED",
    rmaNumber: "RMA-1",
    authorizedAt: later,
    updatedAt: later,
  };
}

function createReceivedReturn(): ReceivedReturnRequest {
  return {
    ...createAuthorizedReturn(),
    status: "RECEIVED",
    receivedAt,
    updatedAt: receivedAt,
  };
}

function createApprovedReturn(): ApprovedReturnRequest {
  return {
    ...createReceivedReturn(),
    status: "APPROVED",
    inspectedAt,
    restockableItems: [{ sku: "sku-1", quantity: 1 }],
    inspectionNote: "one unit restockable",
    updatedAt: inspectedAt,
  };
}

function createTestApp(overrides: {
  createReturnRequestUseCase?: CreateReturnRequestUseCase;
  authorizeReturnUseCase?: AuthorizeReturnUseCase;
  receiveReturnUseCase?: ReceiveReturnUseCase;
  inspectReturnUseCase?: InspectReturnUseCase;
}) {
  return createRouteTestApp({
    createReturnRequestUseCase:
      overrides.createReturnRequestUseCase ??
      (async () => ok({ returnRequest: createRequestedReturn(), idempotent: false })),
    authorizeReturnUseCase:
      overrides.authorizeReturnUseCase ??
      (async () => ok({ returnRequest: createAuthorizedReturn(), idempotent: false })),
    receiveReturnUseCase:
      overrides.receiveReturnUseCase ??
      (async () => ok({ returnRequest: createReceivedReturn(), idempotent: false })),
    inspectReturnUseCase:
      overrides.inspectReturnUseCase ??
      (async () => ok({ returnRequest: createApprovedReturn(), idempotent: false })),
  });
}

function validCreateBody(): string {
  return JSON.stringify({
    orderId: "order-1",
    fulfillmentId: "fulfillment-1",
    idempotencyKey: "return-request-1",
    reason: "wrong size",
    items: [{ sku: "sku-1", quantity: 2 }],
  });
}

describe("returns routes", () => {
  it("returns 201 when return request is created", async () => {
    const app = createTestApp({});

    const response = await app.request("/returns", {
      method: "POST",
      body: validCreateBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid return request body", async () => {
    const app = createTestApp({});

    const response = await app.request("/returns", {
      method: "POST",
      body: JSON.stringify({
        orderId: "order-1",
        fulfillmentId: "fulfillment-1",
        idempotencyKey: "return-request-1",
        reason: "wrong size",
        items: [],
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("returns 200 when RMA authorization succeeds", async () => {
    const app = createTestApp({});

    const response = await app.request("/returns/return-1/authorize", { method: "POST" });

    expect(response.status).toBe(200);
  });

  it("maps receipt before authorization to 409", async () => {
    const app = createTestApp({
      receiveReturnUseCase: async () =>
        err({
          type: "ReturnNotReceivable",
          status: "REQUESTED",
          message: "Return request cannot be received from its current status",
        }),
    });

    const response = await app.request("/returns/return-1/receive", { method: "POST" });

    expect(response.status).toBe(409);
  });

  it("returns 200 when inspection approval succeeds", async () => {
    const app = createTestApp({});

    const response = await app.request("/returns/return-1/inspect", {
      method: "POST",
      body: JSON.stringify({
        accepted: true,
        restockableItems: [{ sku: "sku-1", quantity: 1 }],
        note: "one unit restockable",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
  });

  it("maps missing returns to 404", async () => {
    const app = createTestApp({
      authorizeReturnUseCase: async () =>
        err({
          type: "ReturnRequestNotFound",
          returnId: "missing-return",
          message: "Return request was not found",
        }),
    });

    const response = await app.request("/returns/missing-return/authorize", { method: "POST" });

    expect(response.status).toBe(404);
  });
});
