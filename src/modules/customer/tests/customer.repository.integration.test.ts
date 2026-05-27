import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import { createCustomer, customerRegisteredEvent, suspendCustomer } from "../domain/index.js";
import {
  createKyselyCustomerOutboxRepository,
  createKyselyCustomerRepository,
} from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createCustomerFixture() {
  const created = createCustomer({
    id: "customer-1",
    idempotencyKey: "customer-register-1",
    email: "customer@example.com",
    displayName: "Kim",
    now,
  });
  if (!created.ok) {
    throw new Error("expected customer to be created");
  }
  return created.value;
}

describe.runIf(dockerAvailable)("customer repository integration", () => {
  it("persists customer projections, domain events, and outbox rows", async () => {
    await withTestDatabase(async (db) => {
      const customers = createKyselyCustomerRepository(db);
      const outbox = createKyselyCustomerOutboxRepository(db);
      const customer = createCustomerFixture();
      const registeredEvents = [customerRegisteredEvent(customer)];
      await customers.create(customer, registeredEvents);
      await outbox.saveAll(registeredEvents);

      const loaded = await customers.findByIdForUpdate("customer-1");
      if (loaded === null) {
        throw new Error("expected customer to be loaded");
      }
      const suspended = suspendCustomer(loaded, {
        reason: "payment risk",
        now: later,
      });
      if (!suspended.ok) {
        throw new Error("expected customer to be suspended");
      }
      await customers.save(suspended.value.customer, suspended.value.events);
      await outbox.saveAll(suspended.value.events);

      const saved = await customers.findByEmail("customer@example.com");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "Customer")
        .where("aggregate_id", "=", "customer-1")
        .orderBy("aggregate_version", "asc")
        .execute();
      const outboxRows = await db
        .selectFrom("outbox_events")
        .selectAll()
        .where("aggregate_type", "=", "Customer")
        .where("aggregate_id", "=", "customer-1")
        .orderBy("occurred_at", "asc")
        .execute();

      expect(saved?.status).toBe("SUSPENDED");
      expect(saved?.version).toBe(1);
      expect(domainEventRows.map((row) => row.event_type)).toEqual([
        "CustomerRegistered",
        "CustomerSuspended",
      ]);
      expect(outboxRows.map((row) => row.event_type)).toEqual([
        "CustomerRegistered",
        "CustomerSuspended",
      ]);
    });
  });
});

describe.runIf(!dockerAvailable)("customer repository integration prerequisites", () => {
  it("documents that Docker is required for customer repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
