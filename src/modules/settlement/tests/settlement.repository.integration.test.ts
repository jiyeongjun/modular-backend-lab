import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import { syncSettlement } from "../domain/index.js";
import {
  createKyselySettlementRepository,
  createKyselySettlementSourceReader,
} from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");
const deliveredAt = new Date("2026-01-02T00:00:00.000Z");
const amount = { amount: 10_000, currency: "KRW" } as const;

describe.runIf(dockerAvailable)("settlement repository integration", () => {
  it("creates, loads, and saves settlement projection with domain events", async () => {
    await withTestDatabase(async (db) => {
      const settlements = createKyselySettlementRepository(db);
      const created = syncSettlement({
        id: "settlement:order-1",
        existing: null,
        facts: {
          orderId: "order-1",
          payment: {
            paymentId: "payment-1",
            amount,
            authorizedAt: now,
          },
          refunds: [],
          fulfillment: {
            fulfillmentId: "fulfillment-1",
            deliveredAt,
          },
        },
        now,
      });
      if (!created.ok) {
        throw new Error("expected settlement sync to succeed");
      }

      await settlements.create(created.value.settlement, created.value.events);

      const loaded = await settlements.findByOrderId("order-1");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "Settlement")
        .where("aggregate_id", "=", "settlement:order-1")
        .orderBy("aggregate_version", "asc")
        .execute();

      expect(loaded?.status).toBe("READY");
      expect(loaded?.version).toBe(1);
      expect(domainEventRows.map((row) => row.event_type)).toEqual([
        "SettlementOpened",
        "SettlementMarkedReady",
      ]);
      expect(domainEventRows.map((row) => row.aggregate_version)).toEqual([0, 1]);

      const updated = syncSettlement({
        id: "settlement:order-1",
        existing: loaded,
        facts: {
          orderId: "order-1",
          payment: {
            paymentId: "payment-1",
            amount,
            authorizedAt: now,
          },
          refunds: [
            {
              refundId: "refund-1",
              paymentId: "payment-1",
              amount: { amount: 2_000, currency: "KRW" },
              refundedAt: new Date("2026-01-03T00:00:00.000Z"),
            },
          ],
          fulfillment: {
            fulfillmentId: "fulfillment-1",
            deliveredAt,
          },
        },
        now: new Date("2026-01-03T00:10:00.000Z"),
      });
      if (!updated.ok) {
        throw new Error("expected settlement refund sync to succeed");
      }

      await settlements.save(updated.value.settlement, updated.value.events);
      const saved = await settlements.findByOrderId("order-1");

      expect(saved?.refundedAmount.amount).toBe(2_000);
      expect(saved?.netAmount.amount).toBe(8_000);
      expect(saved?.version).toBe(2);
    });
  });

  it("detects stale settlement versions", async () => {
    await withTestDatabase(async (db) => {
      const settlements = createKyselySettlementRepository(db);
      const created = syncSettlement({
        id: "settlement:order-1",
        existing: null,
        facts: {
          orderId: "order-1",
          payment: {
            paymentId: "payment-1",
            amount,
            authorizedAt: now,
          },
          refunds: [],
          fulfillment: null,
        },
        now,
      });
      if (!created.ok) {
        throw new Error("expected settlement sync to succeed");
      }
      await settlements.create(created.value.settlement, created.value.events);

      const first = await settlements.findByOrderId("order-1");
      const stale = await settlements.findByOrderId("order-1");
      if (first === null || stale === null) {
        throw new Error("expected settlement snapshots");
      }

      const readyFacts = {
        orderId: "order-1",
        payment: {
          paymentId: "payment-1",
          amount,
          authorizedAt: now,
        },
        refunds: [],
        fulfillment: {
          fulfillmentId: "fulfillment-1",
          deliveredAt,
        },
      } as const;
      const ready = syncSettlement({
        id: "settlement:order-1",
        existing: first,
        facts: readyFacts,
        now: deliveredAt,
      });
      const staleReady = syncSettlement({
        id: "settlement:order-1",
        existing: stale,
        facts: readyFacts,
        now: deliveredAt,
      });
      if (!ready.ok || !staleReady.ok) {
        throw new Error("expected ready settlement sync to succeed");
      }

      await settlements.save(ready.value.settlement, ready.value.events);

      await expect(
        settlements.save(staleReady.value.settlement, staleReady.value.events),
      ).rejects.toBeInstanceOf(OptimisticConcurrencyError);
    });
  });

  it("reads source facts and candidate order ids from domain events", async () => {
    await withTestDatabase(async (db) => {
      await db
        .insertInto("domain_events")
        .values([
          {
            id: "Payment:payment-1:0",
            aggregate_type: "Payment",
            aggregate_id: "payment-1",
            aggregate_version: 0,
            event_type: "PaymentAuthorized",
            event_schema_version: 1,
            payload: {
              paymentId: "payment-1",
              orderId: "order-1",
              amount,
              providerPaymentKey: "provider-payment-1",
              providerStatus: "DONE",
              method: "CARD",
              receiptUrl: null,
              authorizedAt: now,
            },
            occurred_at: now,
            created_at: now,
          },
          {
            id: "Fulfillment:fulfillment-1:0",
            aggregate_type: "Fulfillment",
            aggregate_id: "fulfillment-1",
            aggregate_version: 0,
            event_type: "FulfillmentDelivered",
            event_schema_version: 1,
            payload: {
              fulfillmentId: "fulfillment-1",
              orderId: "order-1",
              carrierStatus: "DELIVERED",
              trackingNumber: "tracking-1",
              shippedAt: now,
              deliveredAt,
            },
            occurred_at: deliveredAt,
            created_at: deliveredAt,
          },
        ])
        .execute();

      const reader = createKyselySettlementSourceReader(db);
      const facts = await reader.findFactsByOrderId("order-1");
      const candidates: string[] = [];
      for await (const orderId of reader.iterateCandidateOrderIds({ batchSize: 10 })) {
        candidates.push(orderId);
      }

      expect(facts.payment?.paymentId).toBe("payment-1");
      expect(facts.fulfillment?.fulfillmentId).toBe("fulfillment-1");
      expect(candidates).toEqual(["order-1"]);
    });
  });
});

describe.runIf(!dockerAvailable)("settlement repository integration prerequisites", () => {
  it("documents that Docker is required for settlement repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
