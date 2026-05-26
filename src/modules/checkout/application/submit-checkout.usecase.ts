import type { Money } from "../../../shared/money/index.js";
import { err, ok, type Result } from "../../../shared/result/index.js";
import type { CheckoutCompensation, CheckoutCompleted } from "../domain/index.js";
import type {
  CheckoutInventoryError,
  CheckoutInventoryPort,
  CheckoutInventoryReservation,
  CheckoutOrderError,
  CheckoutOrderPort,
  CheckoutPayment,
  CheckoutPaymentError,
  CheckoutPaymentPort,
} from "../ports/index.js";

export type SubmitCheckoutCommand = Readonly<{
  orderId: string;
  sku: string;
  quantity: number;
  paymentKey: string;
  amount: Money;
  idempotencyKey: string;
}>;

export type SubmitCheckoutError =
  | {
      type: "CheckoutOrderValidationFailed";
      orderError: CheckoutOrderError;
      message: string;
    }
  | {
      type: "CheckoutInventoryReservationFailed";
      inventoryError: CheckoutInventoryError;
      message: string;
    }
  | {
      type: "CheckoutInventoryReservationNotUsable";
      reservationId: string;
      reservationStatus: CheckoutInventoryReservation["status"];
      message: string;
    }
  | {
      type: "CheckoutPaymentConfirmationFailed";
      paymentError: CheckoutPaymentError;
      reservationId: string;
      inventoryRelease: CheckoutCompensation;
      message: string;
    }
  | {
      type: "CheckoutInventoryCommitFailed";
      inventoryError: CheckoutInventoryError;
      reservationId: string;
      paymentId: string;
      inventoryRelease: CheckoutCompensation;
      paymentCancellation: CheckoutCompensation;
      message: string;
    }
  | {
      type: "CheckoutOrderPaymentFailed";
      orderError: CheckoutOrderError;
      reservationId: string;
      paymentId: string;
      paymentCancellation: CheckoutCompensation;
      message: string;
    };

export type SubmitCheckoutUseCase = (
  command: SubmitCheckoutCommand,
) => Promise<Result<CheckoutCompleted, SubmitCheckoutError>>;

export function createSubmitCheckoutUseCase(deps: {
  order: CheckoutOrderPort;
  inventory: CheckoutInventoryPort;
  payment: CheckoutPaymentPort;
  now: () => Date;
  reservationTtlMs: number;
}): SubmitCheckoutUseCase {
  async function releaseIfActive(
    reservation: CheckoutInventoryReservation,
  ): Promise<CheckoutCompensation> {
    if (reservation.status !== "ACTIVE") {
      return { status: "NOT_NEEDED" };
    }

    const released = await deps.inventory.release({ reservationId: reservation.reservationId });
    if (released.ok) {
      return { status: "SUCCEEDED", completedAt: deps.now() };
    }

    return {
      status: "FAILED",
      failureType: "InventoryReleaseFailed",
      message: released.error.message,
    };
  }

  async function cancelPayment(
    payment: CheckoutPayment,
    idempotencyKey: string,
    reason: string,
  ): Promise<CheckoutCompensation> {
    if (payment.status !== "AUTHORIZED") {
      return { status: "NOT_NEEDED" };
    }

    const cancelled = await deps.payment.cancel({
      paymentId: payment.paymentId,
      idempotencyKey,
      reason,
    });

    if (cancelled.ok) {
      return { status: "SUCCEEDED", completedAt: deps.now() };
    }

    return {
      status: "FAILED",
      failureType: "PaymentCancellationFailed",
      message: cancelled.error.message,
    };
  }

  return async function submitCheckoutUseCase(command) {
    const order = await deps.order.validateForCheckout({
      orderId: command.orderId,
      amount: command.amount,
    });
    if (!order.ok) {
      return err({
        type: "CheckoutOrderValidationFailed",
        orderError: order.error,
        message: "Order cannot enter checkout",
      });
    }

    const reserve = await deps.inventory.reserve({
      sku: command.sku,
      quantity: command.quantity,
      idempotencyKey: childIdempotencyKey(command.idempotencyKey, "inventory-reserve"),
      expiresAt: new Date(deps.now().getTime() + deps.reservationTtlMs),
    });
    if (!reserve.ok) {
      return err({
        type: "CheckoutInventoryReservationFailed",
        inventoryError: reserve.error,
        message: "Inventory reservation failed",
      });
    }

    if (reserve.value.status !== "ACTIVE" && reserve.value.status !== "COMMITTED") {
      return err({
        type: "CheckoutInventoryReservationNotUsable",
        reservationId: reserve.value.reservationId,
        reservationStatus: reserve.value.status,
        message: "Existing inventory reservation cannot continue checkout",
      });
    }

    const payment = await deps.payment.confirm({
      orderId: command.orderId,
      paymentKey: command.paymentKey,
      amount: command.amount,
      idempotencyKey: childIdempotencyKey(command.idempotencyKey, "payment-confirm"),
    });
    if (!payment.ok) {
      return err({
        type: "CheckoutPaymentConfirmationFailed",
        paymentError: payment.error,
        reservationId: reserve.value.reservationId,
        inventoryRelease: await releaseIfActive(reserve.value),
        message: "Payment confirmation failed",
      });
    }

    const committed =
      reserve.value.status === "COMMITTED"
        ? ok(reserve.value)
        : await deps.inventory.commit({ reservationId: reserve.value.reservationId });
    if (!committed.ok) {
      return err({
        type: "CheckoutInventoryCommitFailed",
        inventoryError: committed.error,
        reservationId: reserve.value.reservationId,
        paymentId: payment.value.paymentId,
        inventoryRelease: await releaseIfActive(reserve.value),
        paymentCancellation: await cancelPayment(
          payment.value,
          childIdempotencyKey(command.idempotencyKey, "payment-cancel-after-inventory-failure"),
          "Inventory commit failed after payment authorization",
        ),
        message: "Inventory commit failed after payment confirmation",
      });
    }

    const paid = await deps.order.markPaid({ orderId: command.orderId });
    if (!paid.ok) {
      return err({
        type: "CheckoutOrderPaymentFailed",
        orderError: paid.error,
        reservationId: committed.value.reservationId,
        paymentId: payment.value.paymentId,
        paymentCancellation: await cancelPayment(
          payment.value,
          childIdempotencyKey(command.idempotencyKey, "payment-cancel-after-order-failure"),
          "Order payment state update failed after payment authorization",
        ),
        message: "Order payment state update failed after checkout side effects",
      });
    }

    return ok({
      type: "CheckoutCompleted",
      orderId: command.orderId,
      sku: committed.value.sku,
      quantity: committed.value.quantity,
      amount: order.value.amount,
      reservationId: committed.value.reservationId,
      paymentId: payment.value.paymentId,
      completedAt: deps.now(),
    });
  };
}

function childIdempotencyKey(root: string, suffix: string): string {
  return `${root}:${suffix}`;
}
