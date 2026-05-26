import { err, ok, type Result } from "../../../shared/result/index.js";
import { type CancelPaymentError, cancelPayment, type Payment } from "../domain/index.js";
import type { PaymentGateway, PaymentGatewayError, PaymentUnitOfWork } from "../ports/index.js";
import type { PaymentProviderRejection } from "./confirm-payment.usecase.js";

export type CancelPaymentCommand = Readonly<{
  paymentId: string;
  idempotencyKey: string;
  reason: string;
}>;

export type CancelPaymentUseCaseError =
  | CancelPaymentError
  | PaymentProviderRejection
  | {
      type: "PaymentNotFound";
      paymentId: string;
      message: string;
    }
  | {
      type: "PaymentIdempotencyConflict";
      idempotencyKey: string;
      message: string;
    };

export type CancelPaymentUseCaseResult = Readonly<{
  payment: Payment;
  idempotent: boolean;
}>;

export type CancelPaymentUseCase = (
  command: CancelPaymentCommand,
) => Promise<Result<CancelPaymentUseCaseResult, CancelPaymentUseCaseError>>;

export function createCancelPaymentUseCase(deps: {
  uow: PaymentUnitOfWork;
  gateway: PaymentGateway;
  now: () => Date;
}): CancelPaymentUseCase {
  async function loadCancelablePayment(
    command: CancelPaymentCommand,
  ): Promise<Result<Payment, CancelPaymentUseCaseError>> {
    return deps.uow.withTransaction(async ({ payments }) => {
      const existingByKey = await payments.findByCancelIdempotencyKey(command.idempotencyKey);
      if (existingByKey !== null) {
        if (existingByKey.id !== command.paymentId) {
          return err({
            type: "PaymentIdempotencyConflict",
            idempotencyKey: command.idempotencyKey,
            message: "Cancel idempotency key belongs to another payment",
          });
        }

        if (existingByKey.status === "CANCELLED") {
          return ok(existingByKey);
        }
      }

      const payment = await payments.findById(command.paymentId);
      if (payment === null) {
        return err({
          type: "PaymentNotFound",
          paymentId: command.paymentId,
          message: "Payment was not found",
        });
      }

      if (payment.status !== "AUTHORIZED") {
        return err({
          type: "PaymentNotCancellable",
          status: payment.status,
          message: "Payment is not authorized and cannot be cancelled",
        });
      }

      return ok(payment);
    });
  }

  return async function cancelPaymentUseCase(command) {
    const loadResult = await loadCancelablePayment(command);
    if (!loadResult.ok) {
      return loadResult;
    }

    if (loadResult.value.status === "CANCELLED") {
      return ok({ payment: loadResult.value, idempotent: true });
    }

    const gatewayResult = await deps.gateway.cancelPayment({
      paymentKey: loadResult.value.providerPaymentKey,
      cancelReason: command.reason,
      idempotencyKey: command.idempotencyKey,
    });

    if (!gatewayResult.ok) {
      return err(toProviderRejection(gatewayResult.error));
    }

    return deps.uow.withTransaction(async ({ payments, outbox }) => {
      const current = await payments.findByIdForUpdate(command.paymentId);
      if (current === null) {
        throw new Error(`Payment ${command.paymentId} disappeared during cancellation`);
      }

      const cancelled = cancelPayment(
        current,
        {
          cancelIdempotencyKey: command.idempotencyKey,
          cancelReason: command.reason,
          providerStatus: gatewayResult.value.providerStatus,
          cancelledAt: gatewayResult.value.cancelledAt,
        },
        deps.now(),
      );

      if (!cancelled.ok) {
        return cancelled;
      }

      await payments.save(cancelled.value.payment);
      await outbox.saveAll(cancelled.value.events);

      return ok({ payment: cancelled.value.payment, idempotent: false });
    });
  };
}

function toProviderRejection(error: PaymentGatewayError): PaymentProviderRejection {
  return {
    type: "PaymentProviderRejected",
    providerCode: error.code,
    providerMessage: error.message,
    statusCode: error.statusCode,
    retryable: error.retryable,
    message: "Payment provider rejected the request",
  };
}
