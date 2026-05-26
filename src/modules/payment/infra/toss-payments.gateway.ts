import { Buffer } from "node:buffer";
import { z } from "zod";
import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  CancelGatewayPaymentCommand,
  ConfirmGatewayPaymentCommand,
  PaymentGateway,
  PaymentGatewayError,
  PaymentGatewayPayment,
} from "../ports/index.js";

export type PaymentGatewayFetch = (input: string, init: RequestInit) => Promise<Response>;

export type TossPaymentsGatewayConfig = Readonly<{
  secretKey: string;
  baseUrl: string;
  fetchFn?: PaymentGatewayFetch;
}>;

const TossPaymentResponseSchema = z
  .object({
    paymentKey: z.string(),
    orderId: z.string(),
    status: z.string(),
    totalAmount: z.number().int(),
    currency: z.enum(["KRW", "USD"]),
    method: z.string().nullable().optional(),
    approvedAt: z.string().nullable().optional(),
    receipt: z
      .object({
        url: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    cancels: z
      .array(
        z
          .object({
            canceledAt: z.string().nullable().optional(),
          })
          .passthrough(),
      )
      .nullable()
      .optional(),
  })
  .passthrough();

const TossErrorResponseSchema = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .passthrough();

export function createTossPaymentsGateway(config: TossPaymentsGatewayConfig): PaymentGateway {
  const fetchFn = config.fetchFn ?? fetch;

  async function requestTossPayment(
    path: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<Result<PaymentGatewayPayment, PaymentGatewayError>> {
    const response = await fetchFn(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Basic ${toBasicAuthToken(config.secretKey)}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    const responseBody = await readJson(response);

    if (!response.ok) {
      return err(toGatewayError(response, responseBody));
    }

    const parsed = TossPaymentResponseSchema.safeParse(responseBody);
    if (!parsed.success) {
      return err({
        type: "PaymentGatewayRejected",
        provider: "TOSS_PAYMENTS",
        code: "INVALID_TOSS_RESPONSE",
        message: "Toss Payments returned an unexpected response shape",
        statusCode: response.status,
        retryable: true,
      });
    }

    const approvedAt = parseOptionalDate(parsed.data.approvedAt);
    const cancelledAt = parseOptionalDate(findLatestCancelDate(parsed.data.cancels ?? []));

    if (!approvedAt.ok || !cancelledAt.ok) {
      return err({
        type: "PaymentGatewayRejected",
        provider: "TOSS_PAYMENTS",
        code: "INVALID_TOSS_RESPONSE",
        message: "Toss Payments returned an invalid timestamp",
        statusCode: response.status,
        retryable: true,
      });
    }

    return ok({
      provider: "TOSS_PAYMENTS",
      providerPaymentKey: parsed.data.paymentKey,
      orderId: parsed.data.orderId,
      amount: {
        amount: parsed.data.totalAmount,
        currency: parsed.data.currency,
      },
      providerStatus: parsed.data.status,
      method: parsed.data.method ?? null,
      receiptUrl: parsed.data.receipt?.url ?? null,
      approvedAt: approvedAt.value,
      cancelledAt: cancelledAt.value,
    });
  }

  return {
    confirmPayment(command: ConfirmGatewayPaymentCommand) {
      return requestTossPayment(
        "/v1/payments/confirm",
        {
          paymentKey: command.paymentKey,
          orderId: command.orderId,
          amount: command.amount.amount,
        },
        command.idempotencyKey,
      );
    },

    cancelPayment(command: CancelGatewayPaymentCommand) {
      return requestTossPayment(
        `/v1/payments/${encodeURIComponent(command.paymentKey)}/cancel`,
        {
          cancelReason: command.cancelReason,
        },
        command.idempotencyKey,
      );
    },
  };
}

export function createUnavailablePaymentGateway(message: string): PaymentGateway {
  const unavailable: PaymentGatewayError = {
    type: "PaymentGatewayRejected",
    provider: "TOSS_PAYMENTS",
    code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
    message,
    statusCode: 503,
    retryable: true,
  };

  return {
    async confirmPayment() {
      return err(unavailable);
    },

    async cancelPayment() {
      return err(unavailable);
    },
  };
}

function toBasicAuthToken(secretKey: string): string {
  return Buffer.from(`${secretKey}:`, "utf8").toString("base64");
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return {};
  }

  return JSON.parse(text);
}

function toGatewayError(response: Response, body: unknown): PaymentGatewayError {
  const parsed = TossErrorResponseSchema.safeParse(body);
  const retryable = response.status === 429 || response.status >= 500;

  if (!parsed.success) {
    return {
      type: "PaymentGatewayRejected",
      provider: "TOSS_PAYMENTS",
      code: `HTTP_${response.status}`,
      message: "Toss Payments rejected the request",
      statusCode: response.status,
      retryable,
    };
  }

  return {
    type: "PaymentGatewayRejected",
    provider: "TOSS_PAYMENTS",
    code: parsed.data.code,
    message: parsed.data.message,
    statusCode: response.status,
    retryable,
  };
}

function parseOptionalDate(value: string | null | undefined): Result<Date | null, "InvalidDate"> {
  if (value === null || value === undefined) {
    return ok(null);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return err("InvalidDate");
  }

  return ok(date);
}

function findLatestCancelDate(
  cancels: readonly Readonly<{ canceledAt?: string | null | undefined }>[],
): string | null {
  let latest: string | null = null;

  for (const cancel of cancels) {
    if (cancel.canceledAt !== null && cancel.canceledAt !== undefined) {
      latest = cancel.canceledAt;
    }
  }

  return latest;
}
