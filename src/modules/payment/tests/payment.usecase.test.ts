import { describe, expect, it } from "vitest";
import { createCancelPaymentUseCase, createConfirmPaymentUseCase } from "../application/index.js";
import type { AuthorizedPayment, Payment, PaymentEvent } from "../domain/index.js";
import type {
  PaymentGateway,
  PaymentOutboxRepository,
  PaymentRepository,
  PaymentUnitOfWork,
} from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const approvedAt = new Date("2026-01-01T00:00:01.000Z");
const cancelledAt = new Date("2026-01-01T00:00:02.000Z");

function createAuthorizedPayment(
  overrides: Partial<
    Omit<AuthorizedPayment, "status" | "authorizedAt" | "failedAt" | "cancelledAt">
  > = {},
): AuthorizedPayment {
  return {
    id: "payment-1",
    orderId: "order-1",
    provider: "TOSS_PAYMENTS",
    providerPaymentKey: "payment-key-1",
    confirmIdempotencyKey: "confirm-1",
    cancelIdempotencyKey: null,
    amount: { amount: 10_000, currency: "KRW" },
    status: "AUTHORIZED",
    providerStatus: "DONE",
    method: "CARD",
    receiptUrl: "https://receipt.example",
    failureCode: null,
    failureMessage: null,
    cancelReason: null,
    authorizedAt: approvedAt,
    failedAt: null,
    cancelledAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createFakeUow(initialPayments: readonly Payment[] = []): {
  uow: PaymentUnitOfWork;
  payments: Payment[];
  events: PaymentEvent[];
  transactions: () => number;
} {
  const paymentsState: Payment[] = [...initialPayments];
  const events: PaymentEvent[] = [];
  let transactionCount = 0;

  function findBy(predicate: (payment: Payment) => boolean): Payment | null {
    return paymentsState.find(predicate) ?? null;
  }

  const payments: PaymentRepository = {
    findById: async (id) => findBy((payment) => payment.id === id),
    findByIdForUpdate: async (id) => findBy((payment) => payment.id === id),
    findByOrderId: async (orderId) => findBy((payment) => payment.orderId === orderId),
    findByConfirmIdempotencyKey: async (idempotencyKey) =>
      findBy((payment) => payment.confirmIdempotencyKey === idempotencyKey),
    findByCancelIdempotencyKey: async (idempotencyKey) =>
      findBy((payment) => payment.cancelIdempotencyKey === idempotencyKey),
    create: async (payment) => {
      paymentsState.push(payment);
    },
    save: async (payment) => {
      const index = paymentsState.findIndex((existing) => existing.id === payment.id);
      if (index === -1) {
        throw new Error("payment missing");
      }
      paymentsState[index] = payment;
    },
  };

  const outbox: PaymentOutboxRepository = {
    saveAll: async (newEvents) => {
      events.push(...newEvents);
    },
  };

  return {
    uow: {
      async withTransaction(work) {
        transactionCount += 1;
        return work({ payments, outbox });
      },
    },
    payments: paymentsState,
    events,
    transactions: () => transactionCount,
  };
}

function createSuccessfulGateway(): PaymentGateway {
  return {
    async confirmPayment(command) {
      return {
        ok: true,
        value: {
          provider: "TOSS_PAYMENTS",
          providerPaymentKey: command.paymentKey,
          orderId: command.orderId,
          amount: command.amount,
          providerStatus: "DONE",
          method: "CARD",
          receiptUrl: "https://receipt.example",
          approvedAt,
          cancelledAt: null,
        },
      };
    },
    async cancelPayment(command) {
      return {
        ok: true,
        value: {
          provider: "TOSS_PAYMENTS",
          providerPaymentKey: command.paymentKey,
          orderId: "order-1",
          amount: { amount: 10_000, currency: "KRW" },
          providerStatus: "CANCELED",
          method: "CARD",
          receiptUrl: "https://receipt.example",
          approvedAt,
          cancelledAt,
        },
      };
    },
  };
}

describe("payment usecases", () => {
  it("confirms a payment, persists the authorized state, and writes an outbox event", async () => {
    const fake = createFakeUow();
    const confirm = createConfirmPaymentUseCase({
      uow: fake.uow,
      gateway: createSuccessfulGateway(),
      now: () => now,
      generateId: () => "payment-1",
    });

    const result = await confirm({
      orderId: "order-1",
      paymentKey: "payment-key-1",
      amount: { amount: 10_000, currency: "KRW" },
      idempotencyKey: "confirm-1",
    });

    expect(result.ok).toBe(true);
    expect(fake.payments[0]?.status).toBe("AUTHORIZED");
    expect(fake.events[0]?.type).toBe("PaymentAuthorized");
    expect(fake.transactions()).toBe(3);
  });

  it("returns an existing authorized payment for duplicate confirm idempotency key", async () => {
    const existing = createAuthorizedPayment();
    const fake = createFakeUow([existing]);
    const confirm = createConfirmPaymentUseCase({
      uow: fake.uow,
      gateway: createSuccessfulGateway(),
      now: () => now,
      generateId: () => "payment-2",
    });

    const result = await confirm({
      orderId: "order-1",
      paymentKey: "payment-key-1",
      amount: { amount: 10_000, currency: "KRW" },
      idempotencyKey: "confirm-1",
    });

    expect(result).toEqual({ ok: true, value: { payment: existing, idempotent: true } });
    expect(fake.events).toEqual([]);
  });

  it("records a failed payment when the provider rejects confirmation", async () => {
    const fake = createFakeUow();
    const gateway: PaymentGateway = {
      async confirmPayment() {
        return {
          ok: false,
          error: {
            type: "PaymentGatewayRejected",
            provider: "TOSS_PAYMENTS",
            code: "REJECT_CARD_COMPANY",
            message: "Card company rejected the request",
            statusCode: 400,
            retryable: false,
          },
        };
      },
      async cancelPayment() {
        throw new Error("unexpected cancel");
      },
    };
    const confirm = createConfirmPaymentUseCase({
      uow: fake.uow,
      gateway,
      now: () => now,
      generateId: () => "payment-1",
    });

    const result = await confirm({
      orderId: "order-1",
      paymentKey: "payment-key-1",
      amount: { amount: 10_000, currency: "KRW" },
      idempotencyKey: "confirm-1",
    });

    expect(result.ok).toBe(false);
    expect(fake.payments[0]?.status).toBe("FAILED");
    expect(fake.events[0]?.type).toBe("PaymentAuthorizationFailed");
  });

  it("cancels an authorized payment through the provider", async () => {
    const fake = createFakeUow([createAuthorizedPayment()]);
    const cancel = createCancelPaymentUseCase({
      uow: fake.uow,
      gateway: createSuccessfulGateway(),
      now: () => now,
    });

    const result = await cancel({
      paymentId: "payment-1",
      idempotencyKey: "cancel-1",
      reason: "customer request",
    });

    expect(result.ok).toBe(true);
    expect(fake.payments[0]?.status).toBe("CANCELLED");
    expect(fake.events[0]?.type).toBe("PaymentCancelled");
  });
});
