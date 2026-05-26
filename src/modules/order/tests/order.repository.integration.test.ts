import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import { orderCreatedEvent, type PaidOrder, type PendingOrder } from "../domain/index.js";
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

function createPendingOrder(): PendingOrder {
  return {
    id: "order-1",
    status: "PENDING",
    totalAmount: { amount: 10_000, currency: "KRW" },
    paidAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

describe.runIf(dockerAvailable)("order repository integration", () => {
  it("runs migrations, loads and saves orders, and persists outbox events", async () => {
    await withTestDatabase(async (db) => {
      const orders = createKyselyOrderRepository(db);
      const outbox = createKyselyOutboxRepository(db);
      const pending = createPendingOrder();

      await orders.create(pending, [orderCreatedEvent(pending)]);

      const order = await orders.findById("order-1");

      expect(order?.status).toBe("PENDING");
      if (order?.status !== "PENDING") {
        throw new Error("expected pending order");
      }

      const paidEvent = {
        type: "OrderPaid" as const,
        aggregateType: "Order" as const,
        aggregateId: "order-1",
        occurredAt: now,
        payload: {
          orderId: "order-1",
          totalAmount: order.totalAmount,
        },
      };
      await orders.save(toPaidOrder(order), [paidEvent]);
      await outbox.saveAll([paidEvent]);

      const saved = await orders.findById("order-1");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "Order")
        .where("aggregate_id", "=", "order-1")
        .orderBy("aggregate_version", "asc")
        .execute();
      const outboxRows = await db.selectFrom("outbox_events").selectAll().execute();

      expect(saved?.status).toBe("PAID");
      expect(saved?.version).toBe(1);
      expect(domainEventRows.map((row) => row.event_type)).toEqual(["OrderCreated", "OrderPaid"]);
      expect(domainEventRows.map((row) => row.aggregate_version)).toEqual([0, 1]);
      expect(outboxRows).toHaveLength(1);
      expect(outboxRows[0]?.event_type).toBe("OrderPaid");
    });
  });

  it("detects optimistic concurrency conflicts", async () => {
    await withTestDatabase(async (db) => {
      const orders = createKyselyOrderRepository(db);
      const pending = createPendingOrder();

      await orders.create(pending, [orderCreatedEvent(pending)]);

      const first = await orders.findById("order-1");
      const stale = await orders.findById("order-1");

      if (first?.status !== "PENDING" || stale?.status !== "PENDING") {
        throw new Error("expected seeded pending orders");
      }

      await orders.save(toPaidOrder(first), [
        {
          type: "OrderPaid",
          aggregateType: "Order",
          aggregateId: "order-1",
          occurredAt: now,
          payload: {
            orderId: "order-1",
            totalAmount: first.totalAmount,
          },
        },
      ]);

      await expect(
        orders.save(toPaidOrder(stale), [
          {
            type: "OrderPaid",
            aggregateType: "Order",
            aggregateId: "order-1",
            occurredAt: now,
            payload: {
              orderId: "order-1",
              totalAmount: stale.totalAmount,
            },
          },
        ]),
      ).rejects.toBeInstanceOf(OptimisticConcurrencyError);
    });
  });
});

describe.runIf(!dockerAvailable)("order repository integration prerequisites", () => {
  it("documents that Docker is required for repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
