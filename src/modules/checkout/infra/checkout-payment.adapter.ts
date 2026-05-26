import { err, ok } from "../../../shared/result/index.js";
import type {
  CancelPaymentUseCase,
  CancelPaymentUseCaseError,
  ConfirmPaymentUseCase,
  ConfirmPaymentUseCaseError,
} from "../../payment/application/index.js";
import type { CheckoutPaymentError, CheckoutPaymentPort } from "../ports/index.js";

export function createCheckoutPaymentAdapter(deps: {
  confirmPaymentUseCase: ConfirmPaymentUseCase;
  cancelPaymentUseCase: CancelPaymentUseCase;
}): CheckoutPaymentPort {
  return {
    async confirm(command) {
      const result = await deps.confirmPaymentUseCase({
        orderId: command.orderId,
        paymentKey: command.paymentKey,
        amount: command.amount,
        idempotencyKey: command.idempotencyKey,
      });
      if (!result.ok) {
        return err(mapPaymentError(result.error));
      }

      if (result.value.payment.status !== "AUTHORIZED") {
        return err({
          type: "CheckoutPaymentNotAuthorized",
          status: result.value.payment.status,
          message: "Payment confirmation did not produce an authorized payment",
        });
      }

      return ok({
        paymentId: result.value.payment.id,
        orderId: result.value.payment.orderId,
        status: "AUTHORIZED",
      });
    },

    async cancel(command) {
      const result = await deps.cancelPaymentUseCase({
        paymentId: command.paymentId,
        idempotencyKey: command.idempotencyKey,
        reason: command.reason,
      });
      if (!result.ok) {
        return err(mapPaymentError(result.error));
      }

      if (result.value.payment.status !== "CANCELLED") {
        return err({
          type: "CheckoutPaymentRejected",
          reason: "PaymentCancellationUnexpectedStatus",
          message: "Payment cancellation did not produce a cancelled payment",
        });
      }

      return ok({
        paymentId: result.value.payment.id,
        orderId: result.value.payment.orderId,
        status: "CANCELLED",
      });
    },
  };
}

function mapPaymentError(
  error: ConfirmPaymentUseCaseError | CancelPaymentUseCaseError,
): CheckoutPaymentError {
  switch (error.type) {
    case "PaymentProviderRejected":
      return {
        type: "CheckoutPaymentProviderRejected",
        providerCode: error.providerCode,
        statusCode: error.statusCode,
        retryable: error.retryable,
        message: error.providerMessage,
      };

    case "PaymentAlreadyExists":
    case "PaymentAuthorizationMismatch":
    case "PaymentIdempotencyConflict":
    case "PaymentNotCancellable":
    case "PaymentNotConfirmable":
    case "PaymentNotFailable":
    case "PaymentNotFound":
    case "PaymentPreviouslyFailed":
      return {
        type: "CheckoutPaymentRejected",
        reason: error.type,
        message: error.message,
      };

    case "InvalidPaymentAmount":
      return {
        type: "CheckoutPaymentRejected",
        reason: error.type,
        message: error.message,
      };
  }
}
