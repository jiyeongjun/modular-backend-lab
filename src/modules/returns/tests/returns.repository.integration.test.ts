import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import {
  authorizeReturn,
  createReturnRequest,
  receiveReturn,
  returnRequestedEvent,
} from "../domain/index.js";
import {
  createKyselyReturnRequestRepository,
  createKyselyReturnsOutboxRepository,
} from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");
const receivedAt = new Date("2026-01-02T00:00:00.000Z");

function createReturnFixture() {
  const created = createReturnRequest({
    id: "return-1",
    orderId: "order-1",
    fulfillmentId: "fulfillment-1",
    idempotencyKey: "return-request-1",
    reason: "wrong size",
    items: [{ sku: "sku-1", quantity: 2 }],
    now,
  });
  if (!created.ok) {
    throw new Error("expected return request to be created");
  }
  return created.value;
}

describe.runIf(dockerAvailable)("returns repository integration", () => {
  it("persists return projections, domain events, and outbox rows", async () => {
    await withTestDatabase(async (db) => {
      const returns = createKyselyReturnRequestRepository(db);
      const outbox = createKyselyReturnsOutboxRepository(db);
      const returnRequest = createReturnFixture();
      await returns.create(returnRequest, [returnRequestedEvent(returnRequest)]);

      const loaded = await returns.findByIdForUpdate("return-1");
      if (loaded === null) {
        throw new Error("expected return request to be loaded");
      }
      const authorized = authorizeReturn(loaded, {
        rmaNumber: "RMA-1",
        now: later,
      });
      if (!authorized.ok) {
        throw new Error("expected return to authorize");
      }
      await returns.save(authorized.value.returnRequest, authorized.value.events);
      await outbox.saveAll(authorized.value.events);

      const authorizedLoaded = await returns.findByIdForUpdate("return-1");
      if (authorizedLoaded === null) {
        throw new Error("expected authorized return to be loaded");
      }
      const received = receiveReturn(authorizedLoaded, receivedAt);
      if (!received.ok) {
        throw new Error("expected return to receive");
      }
      await returns.save(received.value.returnRequest, received.value.events);
      await outbox.saveAll(received.value.events);

      const saved = await returns.findById("return-1");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "ReturnRequest")
        .where("aggregate_id", "=", "return-1")
        .orderBy("aggregate_version", "asc")
        .execute();
      const outboxRows = await db
        .selectFrom("outbox_events")
        .selectAll()
        .where("aggregate_type", "=", "ReturnRequest")
        .where("aggregate_id", "=", "return-1")
        .orderBy("occurred_at", "asc")
        .execute();

      expect(saved?.status).toBe("RECEIVED");
      expect(saved?.rmaNumber).toBe("RMA-1");
      expect(saved?.version).toBe(2);
      expect(domainEventRows.map((row) => row.event_type)).toEqual([
        "ReturnRequested",
        "ReturnAuthorized",
        "ReturnReceived",
      ]);
      expect(outboxRows.map((row) => row.event_type)).toEqual([
        "ReturnAuthorized",
        "ReturnReceived",
      ]);
    });
  });
});

describe.runIf(!dockerAvailable)("returns repository integration prerequisites", () => {
  it("documents that Docker is required for returns repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
