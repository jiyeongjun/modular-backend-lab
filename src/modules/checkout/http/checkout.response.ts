import type { Result } from "../../../shared/result/index.js";
import type { SubmitCheckoutError } from "../application/index.js";
import type { CheckoutCompensation, CheckoutCompleted } from "../domain/index.js";
import type { CheckoutPaymentError } from "../ports/index.js";

export type CheckoutHttpResponseShape = Readonly<{
  status: 200 | 400 | 404 | 409 | 502 | 503;
  body: unknown;
}>;

export function serializeCheckoutCompleted(result: CheckoutCompleted): Record<string, unknown> {
  return {
    type: result.type,
    orderId: result.orderId,
    sku: result.sku,
    quantity: result.quantity,
    amount: result.amount,
    reservationId: result.reservationId,
    paymentId: result.paymentId,
    completedAt: result.completedAt.toISOString(),
  };
}

export function serializeCheckoutCompensation(
  compensation: CheckoutCompensation,
): Record<string, unknown> {
  switch (compensation.status) {
    case "NOT_NEEDED":
      return { status: compensation.status };

    case "SUCCEEDED":
      return {
        status: compensation.status,
        completedAt: compensation.completedAt.toISOString(),
      };

    case "FAILED":
      return {
        status: compensation.status,
        failureType: compensation.failureType,
        message: compensation.message,
      };
  }
}

export function mapSubmitCheckoutResult(
  result: Result<CheckoutCompleted, SubmitCheckoutError>,
): CheckoutHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeCheckoutCompleted(result.value),
      },
    };
  }

  return mapCheckoutError(result.error);
}

function mapCheckoutError(error: SubmitCheckoutError): CheckoutHttpResponseShape {
  switch (error.type) {
    case "CheckoutOrderValidationFailed":
      return {
        status: mapOrderValidationStatus(error.orderError.type),
        body: { error },
      };

    case "CheckoutInventoryReservationFailed":
      return {
        status: mapInventoryStatus(error.inventoryError.type),
        body: { error },
      };

    case "CheckoutPaymentConfirmationFailed":
      return {
        status: mapPaymentStatus(error.paymentError),
        body: {
          error: {
            ...error,
            inventoryRelease: serializeCheckoutCompensation(error.inventoryRelease),
          },
        },
      };

    case "CheckoutInventoryCommitFailed":
      return {
        status: 409,
        body: {
          error: {
            ...error,
            inventoryRelease: serializeCheckoutCompensation(error.inventoryRelease),
            paymentCancellation: serializeCheckoutCompensation(error.paymentCancellation),
          },
        },
      };

    case "CheckoutOrderPaymentFailed":
      return {
        status: 409,
        body: {
          error: {
            ...error,
            paymentCancellation: serializeCheckoutCompensation(error.paymentCancellation),
          },
        },
      };

    case "CheckoutInventoryReservationNotUsable":
      return {
        status: 409,
        body: { error },
      };
  }
}

function mapOrderValidationStatus(errorType: SubmitCheckoutError["type"] | string): 404 | 409 {
  if (errorType === "CheckoutOrderNotFound") {
    return 404;
  }

  return 409;
}

function mapInventoryStatus(errorType: string): 400 | 404 | 409 {
  switch (errorType) {
    case "CheckoutInventoryItemNotFound":
      return 404;

    case "CheckoutInvalidInventoryRequest":
      return 400;

    case "CheckoutInsufficientInventory":
    case "CheckoutInventoryReservationRejected":
      return 409;

    default:
      return 409;
  }
}

function mapPaymentStatus(error: CheckoutPaymentError): 502 | 503 | 409 {
  switch (error.type) {
    case "CheckoutPaymentProviderRejected":
      return error.statusCode === 503 ? 503 : 502;

    case "CheckoutPaymentNotAuthorized":
    case "CheckoutPaymentRejected":
      return 409;
  }
}
