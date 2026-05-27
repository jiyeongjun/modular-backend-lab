import { describe, expect, it } from "vitest";
import { createRouteTestApp } from "../../../../test/http/create-test-app.js";
import { err, ok } from "../../../shared/result/index.js";
import type {
  CloseCustomerUseCase,
  ReactivateCustomerUseCase,
  RegisterCustomerUseCase,
  SuspendCustomerUseCase,
} from "../application/index.js";
import type { ActiveCustomer, ClosedCustomer, SuspendedCustomer } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createActiveCustomer(): ActiveCustomer {
  return {
    id: "customer-1",
    idempotencyKey: "customer-register-1",
    email: "customer@example.com",
    displayName: "Kim",
    status: "ACTIVE",
    suspendedAt: null,
    suspensionReason: null,
    closedAt: null,
    closureReason: null,
    registeredAt: now,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function createSuspendedCustomer(): SuspendedCustomer {
  return {
    ...createActiveCustomer(),
    status: "SUSPENDED",
    suspendedAt: later,
    suspensionReason: "payment risk",
    updatedAt: later,
  };
}

function createClosedCustomer(): ClosedCustomer {
  return {
    ...createActiveCustomer(),
    status: "CLOSED",
    closedAt: later,
    closureReason: "customer requested closure",
    updatedAt: later,
  };
}

function createTestApp(overrides: {
  registerCustomerUseCase?: RegisterCustomerUseCase;
  suspendCustomerUseCase?: SuspendCustomerUseCase;
  reactivateCustomerUseCase?: ReactivateCustomerUseCase;
  closeCustomerUseCase?: CloseCustomerUseCase;
}) {
  return createRouteTestApp({
    registerCustomerUseCase:
      overrides.registerCustomerUseCase ??
      (async () => ok({ customer: createActiveCustomer(), idempotent: false })),
    suspendCustomerUseCase:
      overrides.suspendCustomerUseCase ??
      (async () => ok({ customer: createSuspendedCustomer(), idempotent: false })),
    reactivateCustomerUseCase:
      overrides.reactivateCustomerUseCase ??
      (async () => ok({ customer: createActiveCustomer(), idempotent: false })),
    closeCustomerUseCase:
      overrides.closeCustomerUseCase ??
      (async () => ok({ customer: createClosedCustomer(), idempotent: false })),
  });
}

function validRegisterBody(): string {
  return JSON.stringify({
    idempotencyKey: "customer-register-1",
    email: "customer@example.com",
    displayName: "Kim",
  });
}

describe("customer routes", () => {
  it("returns 201 when customer is registered", async () => {
    const app = createTestApp({});

    const response = await app.request("/customers", {
      method: "POST",
      body: validRegisterBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid registration body", async () => {
    const app = createTestApp({});

    const response = await app.request("/customers", {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: "customer-register-1",
        email: "not-an-email",
        displayName: "Kim",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("maps duplicate email to 409", async () => {
    const app = createTestApp({
      registerCustomerUseCase: async () =>
        err({
          type: "CustomerEmailAlreadyRegistered",
          email: "customer@example.com",
          message: "Customer email is already registered",
        }),
    });

    const response = await app.request("/customers", {
      method: "POST",
      body: validRegisterBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(409);
  });

  it("returns 200 when customer is suspended", async () => {
    const app = createTestApp({});

    const response = await app.request("/customers/customer-1/suspend", {
      method: "POST",
      body: JSON.stringify({ reason: "payment risk" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
  });

  it("maps missing customer to 404", async () => {
    const app = createTestApp({
      suspendCustomerUseCase: async () =>
        err({
          type: "CustomerNotFound",
          customerId: "missing-customer",
          message: "Customer was not found",
        }),
    });

    const response = await app.request("/customers/missing-customer/suspend", {
      method: "POST",
      body: JSON.stringify({ reason: "payment risk" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(404);
  });

  it("returns 200 when customer is closed", async () => {
    const app = createTestApp({});

    const response = await app.request("/customers/customer-1/close", {
      method: "POST",
      body: JSON.stringify({ reason: "customer requested closure" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
  });
});
