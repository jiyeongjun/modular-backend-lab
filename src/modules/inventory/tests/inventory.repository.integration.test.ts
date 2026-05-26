import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import {
  type ActiveInventoryReservation,
  type InventoryEvent,
  type InventoryItem,
  inventoryStockOpenedEvent,
} from "../domain/index.js";
import {
  createKyselyInventoryItemRepository,
  createKyselyInventoryReservationReader,
  createKyselyInventoryReservationRepository,
} from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");
const expiresAt = new Date("2026-01-02T00:00:00.000Z");

function createReservation(
  overrides: Partial<ActiveInventoryReservation> = {},
): ActiveInventoryReservation {
  return {
    id: "reservation-1",
    sku: "sku-1",
    idempotencyKey: "idem-1",
    quantity: 2,
    status: "ACTIVE",
    expiresAt,
    releasedAt: null,
    committedAt: null,
    expiredAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    sku: "sku-1",
    onHand: 10,
    reserved: 0,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function inventoryReservedEvent(item: InventoryItem, quantity: number): InventoryEvent {
  return {
    type: "InventoryReserved",
    aggregateType: "InventoryItem",
    aggregateId: item.sku,
    occurredAt: now,
    payload: {
      reservationId: "reservation-1",
      sku: item.sku,
      idempotencyKey: "idem-1",
      quantity,
      expiresAt,
    },
  };
}

describe.runIf(dockerAvailable)("inventory repository integration", () => {
  it("loads and saves inventory items and reservations", async () => {
    await withTestDatabase(async (db) => {
      const items = createKyselyInventoryItemRepository(db);
      const reservations = createKyselyInventoryReservationRepository(db);
      const openingItem = createItem();
      await items.create(openingItem, [inventoryStockOpenedEvent(openingItem)]);

      const item = await items.findBySku("sku-1");

      expect(item?.onHand).toBe(10);
      if (item === null) {
        throw new Error("expected inventory item");
      }

      await items.save({ ...item, reserved: 2, updatedAt: now }, [inventoryReservedEvent(item, 2)]);
      await reservations.create(createReservation());

      const savedItem = await items.findBySku("sku-1");
      const savedReservation = await reservations.findById("reservation-1");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "InventoryItem")
        .where("aggregate_id", "=", "sku-1")
        .orderBy("aggregate_version", "asc")
        .execute();

      expect(savedItem?.reserved).toBe(2);
      expect(savedItem?.version).toBe(1);
      expect(savedReservation?.status).toBe("ACTIVE");
      expect(domainEventRows.map((row) => row.event_type)).toEqual([
        "InventoryStockOpened",
        "InventoryReserved",
      ]);
      expect(domainEventRows.map((row) => row.aggregate_version)).toEqual([0, 1]);
    });
  });

  it("detects stale inventory item versions", async () => {
    await withTestDatabase(async (db) => {
      const items = createKyselyInventoryItemRepository(db);
      const openingItem = createItem();
      await items.create(openingItem, [inventoryStockOpenedEvent(openingItem)]);

      const first = await items.findBySku("sku-1");
      const stale = await items.findBySku("sku-1");

      if (first === null || stale === null) {
        throw new Error("expected inventory item snapshots");
      }

      await items.save({ ...first, reserved: 1, updatedAt: now }, [
        inventoryReservedEvent(first, 1),
      ]);

      await expect(
        items.save({ ...stale, reserved: 2, updatedAt: now }, [inventoryReservedEvent(stale, 2)]),
      ).rejects.toBeInstanceOf(OptimisticConcurrencyError);
    });
  });

  it("iterates expired active reservations in bounded batches", async () => {
    await withTestDatabase(async (db) => {
      const items = createKyselyInventoryItemRepository(db);
      const openingItem = createItem({ reserved: 2 });
      await items.create(openingItem, [inventoryStockOpenedEvent(openingItem)]);

      const reservations = createKyselyInventoryReservationRepository(db);
      await reservations.create(
        createReservation({ expiresAt: new Date("2025-12-31T00:00:00.000Z") }),
      );

      const reader = createKyselyInventoryReservationReader(db);
      const expired: ActiveInventoryReservation[] = [];
      for await (const reservation of reader.iterateExpiredActive({ now, batchSize: 10 })) {
        expired.push(reservation);
      }

      expect(expired).toHaveLength(1);
      expect(expired[0]?.id).toBe("reservation-1");
    });
  });
});

describe.runIf(!dockerAvailable)("inventory repository integration prerequisites", () => {
  it("documents that Docker is required for inventory repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
