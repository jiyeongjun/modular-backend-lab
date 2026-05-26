import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { ActiveInventoryReservation } from "../domain/index.js";
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

describe.runIf(dockerAvailable)("inventory repository integration", () => {
  it("loads and saves inventory items and reservations", async () => {
    await withTestDatabase(async (db) => {
      await db
        .insertInto("inventory_items")
        .values({
          sku: "sku-1",
          on_hand: 10,
          reserved: 0,
          version: 0,
          created_at: now,
          updated_at: now,
        })
        .execute();

      const items = createKyselyInventoryItemRepository(db);
      const reservations = createKyselyInventoryReservationRepository(db);
      const item = await items.findBySku("sku-1");

      expect(item?.onHand).toBe(10);
      if (item === null) {
        throw new Error("expected inventory item");
      }

      await items.save({ ...item, reserved: 2, updatedAt: now });
      await reservations.create(createReservation());

      const savedItem = await items.findBySku("sku-1");
      const savedReservation = await reservations.findById("reservation-1");

      expect(savedItem?.reserved).toBe(2);
      expect(savedItem?.version).toBe(1);
      expect(savedReservation?.status).toBe("ACTIVE");
    });
  });

  it("detects stale inventory item versions", async () => {
    await withTestDatabase(async (db) => {
      await db
        .insertInto("inventory_items")
        .values({
          sku: "sku-1",
          on_hand: 10,
          reserved: 0,
          version: 0,
          created_at: now,
          updated_at: now,
        })
        .execute();

      const items = createKyselyInventoryItemRepository(db);
      const first = await items.findBySku("sku-1");
      const stale = await items.findBySku("sku-1");

      if (first === null || stale === null) {
        throw new Error("expected inventory item snapshots");
      }

      await items.save({ ...first, reserved: 1, updatedAt: now });

      await expect(items.save({ ...stale, reserved: 2, updatedAt: now })).rejects.toBeInstanceOf(
        OptimisticConcurrencyError,
      );
    });
  });

  it("iterates expired active reservations in bounded batches", async () => {
    await withTestDatabase(async (db) => {
      await db
        .insertInto("inventory_items")
        .values({
          sku: "sku-1",
          on_hand: 10,
          reserved: 2,
          version: 0,
          created_at: now,
          updated_at: now,
        })
        .execute();

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
