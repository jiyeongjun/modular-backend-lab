import type { Money } from "../../../shared/money/index.js";
import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type AuthorizePaymentError,
  authorizePayment,
  type FailPaymentError,
  failPayment,
  type Payment,
  type PendingPayment,
  paymentStartedEvent,
  type StartPaymentError,
  startPayment,
} from "../domain/index.js";
import type {
  PaymentGateway,
  PaymentGatewayError,
  PaymentGatewayPayment,
  PaymentUnitOfWork,
} from "../ports/index.js";

export type ConfirmPaymentCommand = Readonly<{
  orderId: string;
  paymentKey: string;
  amount: Money;
  idempotencyKey: string;
}>;

export type PaymentProviderRejection = Readonly<{
  type: "PaymentProviderRejected";
  providerCode: string;
  providerMessage: string;
  statusCode: number;
  retryable: boolean;
  message: string;
}>;

export type ConfirmPaymentUseCaseError =
  | StartPaymentError
  | AuthorizePaymentError
  | FailPaymentError
  | PaymentProviderRejection
  | {
      type: "PaymentAlreadyExists";
      orderId: string;
      message: string;
    }
  | {
      type: "PaymentPreviouslyFailed";
      paymentId: string;
      message: string;
    };

export type ConfirmPaymentUseCaseResult = Readonly<{
  payment: Payment;
  idempotent: boolean;
}>;

export type ConfirmPaymentUseCase = (
  command: ConfirmPaymentCommand,
) => Promise<Result<ConfirmPaymentUseCaseResult, ConfirmPaymentUseCaseError>>;

export function createConfirmPaymentUseCase(deps: {
  uow: PaymentUnitOfWork;
  gateway: PaymentGateway;
  now: () => Date;
  generateId: () => string;
}): ConfirmPaymentUseCase {
  async function confirmPendingPayment(
    payment: PendingPayment,
    idempotent: boolean,
  ): Promise<Result<ConfirmPaymentUseCaseResult, ConfirmPaymentUseCaseError>> {
    const gatewayResult = await deps.gateway.confirmPayment({
      paymentKey: payment.providerPaymentKey,
      orderId: payment.orderId,
      amount: payment.amount,
      idempotencyKey: payment.confirmIdempotencyKey,
    });

    if (!gatewayResult.ok) {
      return recordProviderFailure(payment, gatewayResult.error);
    }

    if (gatewayResult.value.providerStatus !== "DONE") {
      return recordUnsupportedProviderStatus(payment, gatewayResult.value);
    }

    return deps.uow.withTransaction(async ({ payments, outbox }) => {
      const current = await payments.findByIdForUpdate(payment.id);
      if (current === null) {
        throw new Error(`Payment ${payment.id} disappeared during confirmation`);
      }

      if (current.status === "AUTHORIZED" || current.status === "CANCELLED") {
        return ok({ payment: current, idempotent: true });
      }

      if (current.status === "FAILED") {
        return err({
          type: "PaymentPreviouslyFailed",
          paymentId: current.id,
          message: "Payment confirmation already failed",
        });
      }

      const authorized = authorizePayment(
        current,
        {
          providerPaymentKey: gatewayResult.value.providerPaymentKey,
          orderId: gatewayResult.value.orderId,
          amount: gatewayResult.value.amount,
          providerStatus: gatewayResult.value.providerStatus,
          method: gatewayResult.value.method,
          receiptUrl: gatewayResult.value.receiptUrl,
          authorizedAt: gatewayResult.value.approvedAt,
        },
        deps.now(),
      );

      if (!authorized.ok) {
        return authorized;
      }

      await payments.save(authorized.value.payment, authorized.value.events);
      await outbox.saveAll(authorized.value.events);

      return ok({ payment: authorized.value.payment, idempotent });
    });
  }

  async function recordProviderFailure(
    payment: PendingPayment,
    gatewayError: PaymentGatewayError,
  ): Promise<Result<ConfirmPaymentUseCaseResult, ConfirmPaymentUseCaseError>> {
    await deps.uow.withTransaction(async ({ payments, outbox }) => {
      const current = await payments.findByIdForUpdate(payment.id);
      if (current === null || current.status !== "PENDING") {
        return;
      }

      const failed = failPayment(
        current,
        {
          providerStatus: null,
          code: gatewayError.code,
          message: gatewayError.message,
        },
        deps.now(),
      );

      if (!failed.ok) {
        return;
      }

      await payments.save(failed.value.payment, failed.value.events);
      await outbox.saveAll(failed.value.events);
    });

    return err(toProviderRejection(gatewayError));
  }

  async function recordUnsupportedProviderStatus(
    payment: PendingPayment,
    gatewayPayment: PaymentGatewayPayment,
  ): Promise<Result<ConfirmPaymentUseCaseResult, ConfirmPaymentUseCaseError>> {
    await deps.uow.withTransaction(async ({ payments, outbox }) => {
      const current = await payments.findByIdForUpdate(payment.id);
      if (current === null || current.status !== "PENDING") {
        return;
      }

      const failed = failPayment(
        current,
        {
          providerStatus: gatewayPayment.providerStatus,
          code: "UNSUPPORTED_PAYMENT_STATUS",
          message: `Unsupported provider payment status: ${gatewayPayment.providerStatus}`,
        },
        deps.now(),
      );

      if (!failed.ok) {
        return;
      }

      await payments.save(failed.value.payment, failed.value.events);
      await outbox.saveAll(failed.value.events);
    });

    return err({
      type: "PaymentProviderRejected",
      providerCode: "UNSUPPORTED_PAYMENT_STATUS",
      providerMessage: `Unsupported provider payment status: ${gatewayPayment.providerStatus}`,
      statusCode: 502,
      retryable: true,
      message: "Payment provider returned a status this module does not support",
    });
  }

  async function confirmExistingPayment(
    payment: Payment,
  ): Promise<Result<ConfirmPaymentUseCaseResult, ConfirmPaymentUseCaseError>> {
    switch (payment.status) {
      case "PENDING":
        return confirmPendingPayment(payment, true);

      case "AUTHORIZED":
      case "CANCELLED":
        return ok({ payment, idempotent: true });

      case "FAILED":
        return err({
          type: "PaymentPreviouslyFailed",
          paymentId: payment.id,
          message: "Payment confirmation already failed",
        });
    }
  }

  return async function confirmPaymentUseCase(command) {
    const existingByKey = await deps.uow.withTransaction(({ payments }) =>
      payments.findByConfirmIdempotencyKey(command.idempotencyKey),
    );

    if (existingByKey !== null) {
      return confirmExistingPayment(existingByKey);
    }

    const started = startPayment({
      id: deps.generateId(),
      orderId: command.orderId,
      providerPaymentKey: command.paymentKey,
      confirmIdempotencyKey: command.idempotencyKey,
      amount: command.amount,
      now: deps.now(),
    });

    if (!started.ok) {
      return err(started.error);
    }

    const created = await deps.uow.withTransaction(async ({ payments, outbox }) => {
      const existingOrderPayment = await payments.findByOrderId(command.orderId);
      if (existingOrderPayment !== null) {
        const error: ConfirmPaymentUseCaseError = {
          type: "PaymentAlreadyExists",
          orderId: command.orderId,
          message: "A payment already exists for this order",
        };
        return err(error);
      }

      const events = [paymentStartedEvent(started.value)];
      await payments.create(started.value, events);
      await outbox.saveAll(events);
      return ok(started.value);
    });

    if (!created.ok) {
      return created;
    }

    return confirmPendingPayment(created.value, false);
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
