import type { Result } from "../../../shared/result/index.js";
import type {
  CancelPaymentUseCaseError,
  CancelPaymentUseCaseResult,
  ConfirmPaymentUseCaseError,
  ConfirmPaymentUseCaseResult,
} from "../application/index.js";
import type { Payment } from "../domain/index.js";

export type PaymentHttpResponseShape = Readonly<{
  status: 200 | 201 | 400 | 404 | 409 | 502 | 503;
  body: unknown;
}>;

export function serializePayment(payment: Payment): Record<string, unknown> {
  return {
    id: payment.id,
    orderId: payment.orderId,
    status: payment.status,
    provider: payment.provider,
    providerPaymentKey: payment.providerPaymentKey,
    amount: payment.amount,
    providerStatus: payment.providerStatus,
    method: payment.method,
    receiptUrl: payment.receiptUrl,
    failureCode: payment.failureCode,
    failureMessage: payment.failureMessage,
    cancelReason: payment.cancelReason,
    authorizedAt: payment.authorizedAt?.toISOString() ?? null,
    failedAt: payment.failedAt?.toISOString() ?? null,
    cancelledAt: payment.cancelledAt?.toISOString() ?? null,
    version: payment.version,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

export function mapConfirmPaymentResult(
  result: Result<ConfirmPaymentUseCaseResult, ConfirmPaymentUseCaseError>,
): PaymentHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializePayment(result.value.payment),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapPaymentError(result.error);
}

export function mapCancelPaymentResult(
  result: Result<CancelPaymentUseCaseResult, CancelPaymentUseCaseError>,
): PaymentHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializePayment(result.value.payment),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapPaymentError(result.error);
}

function mapPaymentError(error: ConfirmPaymentUseCaseError): PaymentHttpResponseShape;
function mapPaymentError(error: CancelPaymentUseCaseError): PaymentHttpResponseShape;
function mapPaymentError(
  error: ConfirmPaymentUseCaseError | CancelPaymentUseCaseError,
): PaymentHttpResponseShape {
  switch (error.type) {
    case "InvalidPaymentAmount":
      return {
        status: 400,
        body: { error },
      };

    case "PaymentNotFound":
      return {
        status: 404,
        body: { error },
      };

    case "PaymentProviderRejected":
      return {
        status: error.statusCode === 503 ? 503 : 502,
        body: { error },
      };

    case "PaymentAlreadyExists":
    case "PaymentAuthorizationMismatch":
    case "PaymentIdempotencyConflict":
    case "PaymentNotCancellable":
    case "PaymentNotConfirmable":
    case "PaymentNotFailable":
    case "PaymentPreviouslyFailed":
      return {
        status: 409,
        body: { error },
      };
  }
}
