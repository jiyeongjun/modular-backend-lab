import { err, ok } from "../../../shared/result/index.js";
import type {
  CancelPaymentUseCase,
  CancelPaymentUseCaseError,
} from "../../payment/application/index.js";
import type { RefundPaymentError, RefundPaymentPort } from "../ports/index.js";

export function createRefundPaymentAdapter(deps: {
  cancelPaymentUseCase: CancelPaymentUseCase;
}): RefundPaymentPort {
  return {
    async refund(command) {
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
          type: "RefundPaymentRejected",
          reason: "PaymentRefundUnexpectedStatus",
          message: "Payment refund did not produce a cancelled payment",
        });
      }

      return ok({
        paymentId: result.value.payment.id,
        status: "REFUNDED",
      });
    },
  };
}

function mapPaymentError(error: CancelPaymentUseCaseError): RefundPaymentError {
  switch (error.type) {
    case "PaymentProviderRejected":
      return {
        type: "RefundPaymentProviderRejected",
        providerCode: error.providerCode,
        statusCode: error.statusCode,
        retryable: error.retryable,
        message: error.providerMessage,
      };

    case "PaymentIdempotencyConflict":
    case "PaymentNotCancellable":
    case "PaymentNotFound":
      return {
        type: "RefundPaymentRejected",
        reason: error.type,
        message: error.message,
      };
  }
}
