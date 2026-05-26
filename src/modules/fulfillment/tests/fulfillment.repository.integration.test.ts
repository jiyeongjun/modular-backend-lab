import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import {
  createFulfillment,
  fulfillmentCreatedEvent,
  markFulfillmentPacked,
  purchaseShippingLabel,
  type TrackableFulfillment,
} from "../domain/index.js";
import {
  createKyselyFulfillmentReader,
  createKyselyFulfillmentRepository,
} from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");
const recipient = {
  name: "Kim",
  phone: "010-0000-0000",
  line1: "Seoul",
  line2: null,
  postalCode: "12345",
  country: "KR",
} as const;
const shipmentPackage = {
  weightGrams: 500,
  description: "T-shirt",
} as const;

function createReadyFulfillment() {
  const created = createFulfillment({
    id: "fulfillment-1",
    orderId: "order-1",
    idempotencyKey: "create-1",
    recipient,
    package: shipmentPackage,
    now,
  });

  if (!created.ok) {
    throw new Error("expected fulfillment to be created");
  }

  return created.value;
}

describe.runIf(dockerAvailable)("fulfillment repository integration", () => {
  it("creates, loads, saves, and iterates trackable fulfillments", async () => {
    await withTestDatabase(async (db) => {
      const fulfillments = createKyselyFulfillmentRepository(db);
      const ready = createReadyFulfillment();
      await fulfillments.create(ready, [fulfillmentCreatedEvent(ready)]);

      const loaded = await fulfillments.findById("fulfillment-1");
      if (loaded === null) {
        throw new Error("expected persisted fulfillment");
      }

      const packed = markFulfillmentPacked(loaded, later);
      if (!packed.ok) {
        throw new Error("expected fulfillment to be packed");
      }

      const labeled = purchaseShippingLabel(packed.value.fulfillment, {
        idempotencyKey: "label-1",
        label: {
          carrier: "LOCAL_TEST_CARRIER",
          carrierShipmentId: "carrier-shipment-1",
          trackingNumber: "tracking-1",
          carrierStatus: "CREATED",
          purchasedAt: later,
        },
        now: later,
      });
      if (!labeled.ok) {
        throw new Error("expected label to be purchased");
      }

      await fulfillments.save(labeled.value.fulfillment, [
        ...packed.value.events,
        ...labeled.value.events,
      ]);

      const saved = await fulfillments.findByLabelIdempotencyKey("label-1");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "Fulfillment")
        .where("aggregate_id", "=", "fulfillment-1")
        .orderBy("aggregate_version", "asc")
        .execute();

      expect(saved?.status).toBe("LABEL_PURCHASED");
      expect(saved?.version).toBe(2);
      expect(domainEventRows.map((row) => row.event_type)).toEqual([
        "FulfillmentCreated",
        "FulfillmentPacked",
        "ShippingLabelPurchased",
      ]);
      expect(domainEventRows.map((row) => row.aggregate_version)).toEqual([0, 1, 2]);

      const reader = createKyselyFulfillmentReader(db);
      const trackable: TrackableFulfillment[] = [];
      for await (const fulfillment of reader.iterateTrackable({ batchSize: 10 })) {
        trackable.push(fulfillment);
      }

      expect(trackable).toHaveLength(1);
      expect(trackable[0]?.id).toBe("fulfillment-1");
    });
  });

  it("detects stale fulfillment versions", async () => {
    await withTestDatabase(async (db) => {
      const fulfillments = createKyselyFulfillmentRepository(db);
      const ready = createReadyFulfillment();
      await fulfillments.create(ready, [fulfillmentCreatedEvent(ready)]);

      const first = await fulfillments.findById("fulfillment-1");
      const stale = await fulfillments.findById("fulfillment-1");
      if (first === null || stale === null) {
        throw new Error("expected fulfillment snapshots");
      }

      const packed = markFulfillmentPacked(first, later);
      const stalePacked = markFulfillmentPacked(stale, later);
      if (!packed.ok || !stalePacked.ok) {
        throw new Error("expected fulfillment to be packed");
      }

      await fulfillments.save(packed.value.fulfillment, packed.value.events);

      await expect(
        fulfillments.save(stalePacked.value.fulfillment, stalePacked.value.events),
      ).rejects.toBeInstanceOf(OptimisticConcurrencyError);
    });
  });
});

describe.runIf(!dockerAvailable)("fulfillment repository integration prerequisites", () => {
  it("documents that Docker is required for fulfillment repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
