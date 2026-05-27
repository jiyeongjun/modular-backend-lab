import { describe, expect, it } from "vitest";
import {
  createCloseCustomerUseCase,
  createReactivateCustomerUseCase,
  createRegisterCustomerUseCase,
  createSuspendCustomerUseCase,
} from "../application/index.js";
import type { Customer, CustomerEvent } from "../domain/index.js";
import type {
  CustomerOutboxRepository,
  CustomerRepository,
  CustomerUnitOfWork,
} from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");
const muchLater = new Date("2026-01-01T00:20:00.000Z");

function createFakeUow(): {
  uow: CustomerUnitOfWork;
  customers: Customer[];
  outboxEvents: CustomerEvent[];
} {
  const customerState: Customer[] = [];
  const outboxEvents: CustomerEvent[] = [];

  function findBy(predicate: (customer: Customer) => boolean): Customer | null {
    return customerState.find(predicate) ?? null;
  }

  const customers: CustomerRepository = {
    findById: async (id) => findBy((customer) => customer.id === id),
    findByIdForUpdate: async (id) => findBy((customer) => customer.id === id),
    findByEmail: async (email) => findBy((customer) => customer.email === email),
    findByIdempotencyKey: async (idempotencyKey) =>
      findBy((customer) => customer.idempotencyKey === idempotencyKey),
    create: async (customer) => {
      customerState.push(customer);
    },
    save: async (customer) => {
      const index = customerState.findIndex((current) => current.id === customer.id);
      if (index === -1) {
        throw new Error("customer missing");
      }
      customerState[index] = customer;
    },
  };

  const outbox: CustomerOutboxRepository = {
    saveAll: async (events) => {
      outboxEvents.push(...events);
    },
  };

  return {
    uow: {
      async withTransaction(work) {
        return work({ customers, outbox });
      },
    },
    customers: customerState,
    outboxEvents,
  };
}

async function registerCustomerFixture(fake: ReturnType<typeof createFakeUow>): Promise<void> {
  const register = createRegisterCustomerUseCase({
    uow: fake.uow,
    now: () => now,
    generateId: () => "customer-1",
  });
  const result = await register({
    idempotencyKey: "customer-register-1",
    email: "customer@example.com",
    displayName: "Kim",
  });
  if (!result.ok) {
    throw new Error("expected customer fixture to be registered");
  }
}

describe("customer usecases", () => {
  it("registers customers idempotently by idempotency key", async () => {
    const fake = createFakeUow();
    const register = createRegisterCustomerUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "customer-1",
    });

    const first = await register({
      idempotencyKey: "customer-register-1",
      email: "CUSTOMER@EXAMPLE.COM",
      displayName: "Kim",
    });
    const second = await register({
      idempotencyKey: "customer-register-1",
      email: "customer@example.com",
      displayName: "Kim",
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("expected registration to succeed");
    }
    expect(first.value.idempotent).toBe(false);
    expect(second.value.idempotent).toBe(true);
    expect(fake.customers).toHaveLength(1);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual(["CustomerRegistered"]);
  });

  it("rejects duplicate customer emails", async () => {
    const fake = createFakeUow();
    await registerCustomerFixture(fake);
    const register = createRegisterCustomerUseCase({
      uow: fake.uow,
      now: () => later,
      generateId: () => "customer-2",
    });

    const result = await register({
      idempotencyKey: "customer-register-2",
      email: "CUSTOMER@EXAMPLE.COM",
      displayName: "Kim",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected duplicate email to fail");
    }
    expect(result.error.type).toBe("CustomerEmailAlreadyRegistered");
  });

  it("suspends and reactivates customers through the unit of work", async () => {
    const fake = createFakeUow();
    await registerCustomerFixture(fake);
    const suspend = createSuspendCustomerUseCase({
      uow: fake.uow,
      now: () => later,
    });
    const reactivate = createReactivateCustomerUseCase({
      uow: fake.uow,
      now: () => muchLater,
    });

    const suspended = await suspend({
      customerId: "customer-1",
      reason: "payment risk",
    });
    const active = await reactivate({ customerId: "customer-1" });

    expect(suspended.ok).toBe(true);
    expect(active.ok).toBe(true);
    if (!suspended.ok || !active.ok) {
      throw new Error("expected customer lifecycle to succeed");
    }
    expect(suspended.value.customer.status).toBe("SUSPENDED");
    expect(active.value.customer.status).toBe("ACTIVE");
    expect(fake.outboxEvents.map((event) => event.type)).toEqual([
      "CustomerRegistered",
      "CustomerSuspended",
      "CustomerReactivated",
    ]);
  });

  it("does not reactivate closed customers", async () => {
    const fake = createFakeUow();
    await registerCustomerFixture(fake);
    const close = createCloseCustomerUseCase({
      uow: fake.uow,
      now: () => later,
    });
    const reactivate = createReactivateCustomerUseCase({
      uow: fake.uow,
      now: () => muchLater,
    });

    await close({ customerId: "customer-1", reason: "customer requested closure" });
    const result = await reactivate({ customerId: "customer-1" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected reactivation to fail");
    }
    expect(result.error.type).toBe("CustomerNotReactivatable");
  });
});
