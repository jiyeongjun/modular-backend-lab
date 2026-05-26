import { describe, expect, it } from "vitest";
import { err, ok } from "../../../shared/result/index.js";
import { createSubmitCheckoutUseCase } from "../application/index.js";
import type {
  CheckoutInventoryPort,
  CheckoutInventoryReservation,
  CheckoutOrderPort,
  CheckoutPayment,
  CheckoutPaymentPort,
} from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const amount = { amount: 10_000, currency: "KRW" } as const;

function createReservation(
  status: CheckoutInventoryReservation["status"] = "ACTIVE",
): CheckoutInventoryReservation {
  return {
    reservationId: "reservation-1",
    sku: "sku-1",
    quantity: 2,
    status,
  };
}

function createPayment(): CheckoutPayment {
  return {
    paymentId: "payment-1",
    orderId: "order-1",
    status: "AUTHORIZED",
  };
}

function createPorts(
  overrides: {
    order?: Partial<CheckoutOrderPort>;
    inventory?: Partial<CheckoutInventoryPort>;
    payment?: Partial<CheckoutPaymentPort>;
  } = {},
): {
  order: CheckoutOrderPort;
  inventory: CheckoutInventoryPort;
  payment: CheckoutPaymentPort;
  calls: string[];
} {
  const calls: string[] = [];

  const order: CheckoutOrderPort = {
    validateForCheckout: async (command) => {
      calls.push("order.validate");
      return ok({ orderId: command.orderId, amount: command.amount });
    },
    markPaid: async (command) => {
      calls.push("order.markPaid");
      return ok({ orderId: command.orderId, status: "PAID", idempotent: false });
    },
    ...overrides.order,
  };
  const inventory: CheckoutInventoryPort = {
    reserve: async () => {
      calls.push("inventory.reserve");
      return ok(createReservation("ACTIVE"));
    },
    commit: async () => {
      calls.push("inventory.commit");
      return ok(createReservation("COMMITTED"));
    },
    release: async () => {
      calls.push("inventory.release");
      return ok(createReservation("RELEASED"));
    },
    ...overrides.inventory,
  };
  const payment: CheckoutPaymentPort = {
    confirm: async () => {
      calls.push("payment.confirm");
      return ok(createPayment());
    },
    cancel: async () => {
      calls.push("payment.cancel");
      return ok({ ...createPayment(), status: "CANCELLED" });
    },
    ...overrides.payment,
  };

  return { order, inventory, payment, calls };
}

function createUseCase(ports: {
  order: CheckoutOrderPort;
  inventory: CheckoutInventoryPort;
  payment: CheckoutPaymentPort;
}) {
  return createSubmitCheckoutUseCase({
    ...ports,
    now: () => now,
    reservationTtlMs: 15 * 60 * 1000,
  });
}

const command = {
  orderId: "order-1",
  sku: "sku-1",
  quantity: 2,
  paymentKey: "payment-key-1",
  amount,
  idempotencyKey: "checkout-1",
} as const;

describe("submit checkout usecase", () => {
  it("validates order, reserves inventory, confirms payment, commits inventory, and marks order paid", async () => {
    const ports = createPorts();
    const checkout = createUseCase(ports);

    const result = await checkout(command);

    expect(result.ok).toBe(true);
    expect(ports.calls).toEqual([
      "order.validate",
      "inventory.reserve",
      "payment.confirm",
      "inventory.commit",
      "order.markPaid",
    ]);
    if (!result.ok) {
      throw new Error("expected checkout to complete");
    }
    expect(result.value).toMatchObject({
      type: "CheckoutCompleted",
      orderId: "order-1",
      reservationId: "reservation-1",
      paymentId: "payment-1",
    });
  });

  it("stops before side effects when order validation fails", async () => {
    const ports = createPorts({
      order: {
        validateForCheckout: async () => {
          ports.calls.push("order.validate");
          return err({
            type: "CheckoutOrderNotFound",
            orderId: "order-1",
            message: "Order was not found",
          });
        },
      },
    });
    const checkout = createUseCase(ports);

    const result = await checkout(command);

    expect(result.ok).toBe(false);
    expect(ports.calls).toEqual(["order.validate"]);
  });

  it("releases active inventory when payment confirmation fails", async () => {
    const ports = createPorts({
      payment: {
        confirm: async () => {
          ports.calls.push("payment.confirm");
          return err({
            type: "CheckoutPaymentProviderRejected",
            providerCode: "REJECT_CARD_COMPANY",
            statusCode: 400,
            retryable: false,
            message: "Card company rejected the request",
          });
        },
      },
    });
    const checkout = createUseCase(ports);

    const result = await checkout(command);

    expect(result.ok).toBe(false);
    expect(ports.calls).toEqual([
      "order.validate",
      "inventory.reserve",
      "payment.confirm",
      "inventory.release",
    ]);
    if (result.ok || result.error.type !== "CheckoutPaymentConfirmationFailed") {
      throw new Error("expected payment confirmation failure");
    }
    expect(result.error.inventoryRelease.status).toBe("SUCCEEDED");
  });

  it("cancels payment and releases inventory when inventory commit fails", async () => {
    const ports = createPorts({
      inventory: {
        commit: async () => {
          ports.calls.push("inventory.commit");
          return err({
            type: "CheckoutInventoryReservationRejected",
            reason: "InventoryInvariantViolation",
            message: "Reservation quantity exceeds current inventory counters",
          });
        },
      },
    });
    const checkout = createUseCase(ports);

    const result = await checkout(command);

    expect(result.ok).toBe(false);
    expect(ports.calls).toEqual([
      "order.validate",
      "inventory.reserve",
      "payment.confirm",
      "inventory.commit",
      "inventory.release",
      "payment.cancel",
    ]);
    if (result.ok || result.error.type !== "CheckoutInventoryCommitFailed") {
      throw new Error("expected inventory commit failure");
    }
    expect(result.error.inventoryRelease.status).toBe("SUCCEEDED");
    expect(result.error.paymentCancellation.status).toBe("SUCCEEDED");
  });
});
