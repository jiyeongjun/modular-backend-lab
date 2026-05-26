import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import { authorizePayment, paymentStartedEvent, startPayment } from "../domain/index.js";
import { createKyselyPaymentRepository } from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");
const approvedAt = new Date("2026-01-01T00:00:01.000Z");

describe.runIf(dockerAvailable)("payment repository integration", () => {
  it("creates, loads, and saves payment state transitions", async () => {
    await withTestDatabase(async (db) => {
      const started = startPayment({
        id: "payment-1",
        orderId: "order-1",
        providerPaymentKey: "payment-key-1",
        confirmIdempotencyKey: "confirm-1",
        amount: { amount: 10_000, currency: "KRW" },
        now,
      });

      if (!started.ok) {
        throw new Error("expected payment to start");
      }

      const payments = createKyselyPaymentRepository(db);
      await payments.create(started.value, [paymentStartedEvent(started.value)]);

      const loaded = await payments.findByConfirmIdempotencyKey("confirm-1");
      if (loaded === null) {
        throw new Error("expected persisted payment");
      }

      const authorized = authorizePayment(
        loaded,
        {
          providerPaymentKey: "payment-key-1",
          orderId: "order-1",
          amount: { amount: 10_000, currency: "KRW" },
          providerStatus: "DONE",
          method: "CARD",
          receiptUrl: "https://receipt.example",
          authorizedAt: approvedAt,
        },
        now,
      );

      if (!authorized.ok) {
        throw new Error("expected payment to authorize");
      }

      await payments.save(authorized.value.payment, authorized.value.events);
      const saved = await payments.findById("payment-1");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "Payment")
        .where("aggregate_id", "=", "payment-1")
        .orderBy("aggregate_version", "asc")
        .execute();

      expect(saved?.status).toBe("AUTHORIZED");
      expect(saved?.version).toBe(1);
      expect(domainEventRows.map((row) => row.event_type)).toEqual([
        "PaymentStarted",
        "PaymentAuthorized",
      ]);
      expect(domainEventRows.map((row) => row.aggregate_version)).toEqual([0, 1]);
    });
  });

  it("detects stale payment versions", async () => {
    await withTestDatabase(async (db) => {
      const started = startPayment({
        id: "payment-1",
        orderId: "order-1",
        providerPaymentKey: "payment-key-1",
        confirmIdempotencyKey: "confirm-1",
        amount: { amount: 10_000, currency: "KRW" },
        now,
      });

      if (!started.ok) {
        throw new Error("expected payment to start");
      }

      const payments = createKyselyPaymentRepository(db);
      await payments.create(started.value, [paymentStartedEvent(started.value)]);

      const first = await payments.findById("payment-1");
      const stale = await payments.findById("payment-1");
      if (first === null || stale === null) {
        throw new Error("expected payment snapshots");
      }

      const authorized = authorizePayment(
        first,
        {
          providerPaymentKey: "payment-key-1",
          orderId: "order-1",
          amount: { amount: 10_000, currency: "KRW" },
          providerStatus: "DONE",
          method: "CARD",
          receiptUrl: "https://receipt.example",
          authorizedAt: approvedAt,
        },
        now,
      );
      const staleAuthorized = authorizePayment(
        stale,
        {
          providerPaymentKey: "payment-key-1",
          orderId: "order-1",
          amount: { amount: 10_000, currency: "KRW" },
          providerStatus: "DONE",
          method: "CARD",
          receiptUrl: "https://receipt.example",
          authorizedAt: approvedAt,
        },
        now,
      );

      if (!authorized.ok || !staleAuthorized.ok) {
        throw new Error("expected payment to authorize");
      }

      await payments.save(authorized.value.payment, authorized.value.events);

      await expect(
        payments.save(staleAuthorized.value.payment, staleAuthorized.value.events),
      ).rejects.toBeInstanceOf(OptimisticConcurrencyError);
    });
  });
});

describe.runIf(!dockerAvailable)("payment repository integration prerequisites", () => {
  it("documents that Docker is required for payment repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
