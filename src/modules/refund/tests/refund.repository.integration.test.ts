import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import {
  approveRefund,
  createRefund,
  markPaymentRefunded,
  refundRequestedEvent,
} from "../domain/index.js";
import { createKyselyRefundRepository } from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");
const amount = { amount: 10_000, currency: "KRW" } as const;

function createRequestedRefund() {
  const created = createRefund({
    id: "refund-1",
    orderId: "order-1",
    paymentId: "payment-1",
    idempotencyKey: "refund-request-1",
    amount,
    reason: "customer request",
    returnRequired: false,
    restock: null,
    now,
  });

  if (!created.ok) {
    throw new Error("expected refund to be created");
  }

  return created.value;
}

describe.runIf(dockerAvailable)("refund repository integration", () => {
  it("creates, loads, and saves refund state transitions", async () => {
    await withTestDatabase(async (db) => {
      const refunds = createKyselyRefundRepository(db);
      const requested = createRequestedRefund();
      await refunds.create(requested, [refundRequestedEvent(requested)]);

      const loaded = await refunds.findByIdempotencyKey("refund-request-1");
      if (loaded === null) {
        throw new Error("expected persisted refund");
      }

      const approved = approveRefund(loaded, later);
      if (!approved.ok) {
        throw new Error("expected refund to approve");
      }

      const paymentRefunded = markPaymentRefunded(approved.value.refund, later);
      if (!paymentRefunded.ok) {
        throw new Error("expected payment refund to be recorded");
      }

      await refunds.save(paymentRefunded.value.refund, [
        ...approved.value.events,
        ...paymentRefunded.value.events,
      ]);
      const saved = await refunds.findById("refund-1");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "Refund")
        .where("aggregate_id", "=", "refund-1")
        .orderBy("aggregate_version", "asc")
        .execute();

      expect(saved?.status).toBe("PAYMENT_REFUNDED");
      expect(saved?.version).toBe(2);
      expect(domainEventRows.map((row) => row.event_type)).toEqual([
        "RefundRequested",
        "RefundApproved",
        "RefundPaymentRefunded",
      ]);
      expect(domainEventRows.map((row) => row.aggregate_version)).toEqual([0, 1, 2]);
    });
  });

  it("detects stale refund versions", async () => {
    await withTestDatabase(async (db) => {
      const refunds = createKyselyRefundRepository(db);
      const requested = createRequestedRefund();
      await refunds.create(requested, [refundRequestedEvent(requested)]);

      const first = await refunds.findById("refund-1");
      const stale = await refunds.findById("refund-1");
      if (first === null || stale === null) {
        throw new Error("expected refund snapshots");
      }

      const approved = approveRefund(first, later);
      const staleApproved = approveRefund(stale, later);
      if (!approved.ok || !staleApproved.ok) {
        throw new Error("expected refund to approve");
      }

      await refunds.save(approved.value.refund, approved.value.events);

      await expect(
        refunds.save(staleApproved.value.refund, staleApproved.value.events),
      ).rejects.toBeInstanceOf(OptimisticConcurrencyError);
    });
  });
});

describe.runIf(!dockerAvailable)("refund repository integration prerequisites", () => {
  it("documents that Docker is required for refund repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
