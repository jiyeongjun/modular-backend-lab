import type { Money } from "../../../shared/money/index.js";

export type CheckoutFailureStep =
  | "ORDER_VALIDATION"
  | "INVENTORY_RESERVATION"
  | "PAYMENT_CONFIRMATION"
  | "INVENTORY_COMMIT"
  | "ORDER_PAYMENT";

export type CheckoutCompensation =
  | { status: "NOT_NEEDED" }
  | { status: "SUCCEEDED"; completedAt: Date }
  | {
      status: "FAILED";
      failureType: "InventoryReleaseFailed" | "PaymentCancellationFailed";
      message: string;
    };

export type CheckoutCompleted = Readonly<{
  type: "CheckoutCompleted";
  orderId: string;
  sku: string;
  quantity: number;
  amount: Money;
  reservationId: string;
  paymentId: string;
  completedAt: Date;
}>;

export type CheckoutFailure = Readonly<{
  step: CheckoutFailureStep;
  message: string;
  inventoryRelease: CheckoutCompensation;
  paymentCancellation: CheckoutCompensation;
}>;
