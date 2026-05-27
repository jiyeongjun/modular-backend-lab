import { describe, expect, it } from "vitest";
import {
  closeCustomer,
  createCustomer,
  reactivateCustomer,
  suspendCustomer,
} from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");
const muchLater = new Date("2026-01-01T00:20:00.000Z");

function createCustomerFixture() {
  const created = createCustomer({
    id: "customer-1",
    idempotencyKey: "customer-register-1",
    email: "CUSTOMER@EXAMPLE.COM",
    displayName: "  Kim  ",
    now,
  });
  if (!created.ok) {
    throw new Error("expected customer to be created");
  }
  return created.value;
}

describe("customer domain behavior", () => {
  it("registers an active customer with normalized identity fields", () => {
    const customer = createCustomerFixture();

    expect(customer.status).toBe("ACTIVE");
    expect(customer.email).toBe("customer@example.com");
    expect(customer.displayName).toBe("Kim");
  });

  it("suspends and reactivates a customer", () => {
    const suspended = suspendCustomer(createCustomerFixture(), {
      reason: "payment risk",
      now: later,
    });
    expect(suspended.ok).toBe(true);
    if (!suspended.ok) {
      throw new Error("expected customer to be suspended");
    }

    const active = reactivateCustomer(suspended.value.customer, muchLater);

    expect(active.ok).toBe(true);
    if (!active.ok) {
      throw new Error("expected customer to be reactivated");
    }
    expect(active.value.customer.status).toBe("ACTIVE");
    expect(active.value.events.map((event) => event.type)).toEqual(["CustomerReactivated"]);
  });

  it("does not reactivate closed customers", () => {
    const closed = closeCustomer(createCustomerFixture(), {
      reason: "customer requested closure",
      now: later,
    });
    if (!closed.ok) {
      throw new Error("expected customer to be closed");
    }

    const result = reactivateCustomer(closed.value.customer, muchLater);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected reactivation to fail");
    }
    expect(result.error.type).toBe("CustomerNotReactivatable");
  });

  it("treats repeated closure as idempotent", () => {
    const closed = closeCustomer(createCustomerFixture(), {
      reason: "customer requested closure",
      now: later,
    });
    if (!closed.ok) {
      throw new Error("expected customer to be closed");
    }

    const repeated = closeCustomer(closed.value.customer, {
      reason: "customer requested closure",
      now: muchLater,
    });

    expect(repeated.ok).toBe(true);
    if (!repeated.ok) {
      throw new Error("expected repeated closure to be idempotent");
    }
    expect(repeated.value.events).toEqual([]);
  });
});
