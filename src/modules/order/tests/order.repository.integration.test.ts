import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { PaidOrder, PendingOrder } from "../domain/index.js";
import { createKyselyOrderRepository, createKyselyOutboxRepository } from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");

function toPaidOrder(order: PendingOrder): PaidOrder {
  return {
    ...order,
    status: "PAID",
    paidAt: now,
    updatedAt: now,
  };
}

describe.runIf(dockerAvailable)("order repository integration", () => {
  it("runs migrations, loads and saves orders, and persists outbox events", async () => {
    await withTestDatabase(async (db) => {
      await db
        .insertInto("orders")
        .values({
          id: "order-1",
          status: "PENDING",
          total_amount: 10_000,
          currency: "KRW",
          paid_at: null,
          version: 0,
          created_at: now,
          updated_at: now,
        })
        .execute();

      const orders = createKyselyOrderRepository(db);
      const outbox = createKyselyOutboxRepository(db);
      const order = await orders.findById("order-1");

      expect(order?.status).toBe("PENDING");
      if (order?.status !== "PENDING") {
        throw new Error("expected pending order");
      }

      await orders.save(toPaidOrder(order));
      await outbox.saveAll([
        {
          type: "OrderPaid",
          aggregateType: "Order",
          aggregateId: "order-1",
          occurredAt: now,
          payload: {
            orderId: "order-1",
            totalAmount: order.totalAmount,
          },
        },
      ]);

      const saved = await orders.findById("order-1");
      const outboxRows = await db.selectFrom("outbox_events").selectAll().execute();

      expect(saved?.status).toBe("PAID");
      expect(saved?.version).toBe(1);
      expect(outboxRows).toHaveLength(1);
      expect(outboxRows[0]?.event_type).toBe("OrderPaid");
    });
  });

  it("detects optimistic concurrency conflicts", async () => {
    await withTestDatabase(async (db) => {
      await db
        .insertInto("orders")
        .values({
          id: "order-1",
          status: "PENDING",
          total_amount: 10_000,
          currency: "KRW",
          paid_at: null,
          version: 0,
          created_at: now,
          updated_at: now,
        })
        .execute();

      const orders = createKyselyOrderRepository(db);
      const first = await orders.findById("order-1");
      const stale = await orders.findById("order-1");

      if (first?.status !== "PENDING" || stale?.status !== "PENDING") {
        throw new Error("expected seeded pending orders");
      }

      await orders.save(toPaidOrder(first));

      await expect(orders.save(toPaidOrder(stale))).rejects.toBeInstanceOf(
        OptimisticConcurrencyError,
      );
    });
  });
});

describe.runIf(!dockerAvailable)("order repository integration prerequisites", () => {
  it("documents that Docker is required for repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
