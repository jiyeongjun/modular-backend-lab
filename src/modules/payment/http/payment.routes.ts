import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type { CancelPaymentUseCase, ConfirmPaymentUseCase } from "../application/index.js";
import { mapCancelPaymentResult, mapConfirmPaymentResult } from "./payment.response.js";
import {
  CancelPaymentBodySchema,
  ConfirmPaymentBodySchema,
  PaymentParamsSchema,
} from "./payment.schemas.js";

export function createPaymentRoutes(deps: {
  confirmPaymentUseCase: ConfirmPaymentUseCase;
  cancelPaymentUseCase: CancelPaymentUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/payments/confirm", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = ConfirmPaymentBodySchema.safeParse(rawBody);

    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid payment confirmation request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.confirmPaymentUseCase({
      orderId: body.data.orderId,
      paymentKey: body.data.paymentKey,
      amount: {
        amount: body.data.amount,
        currency: body.data.currency,
      },
      idempotencyKey: body.data.idempotencyKey,
    });
    const response = mapConfirmPaymentResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/payments/:paymentId/cancel", async (c) => {
    const params = PaymentParamsSchema.safeParse(c.req.param());
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = CancelPaymentBodySchema.safeParse(rawBody);

    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid payment cancellation request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.cancelPaymentUseCase({
      paymentId: params.data.paymentId,
      idempotencyKey: body.data.idempotencyKey,
      reason: body.data.reason,
    });
    const response = mapCancelPaymentResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
