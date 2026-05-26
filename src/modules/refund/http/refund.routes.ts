import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type {
  ProcessRefundUseCase,
  RejectRefundUseCase,
  RequestRefundUseCase,
} from "../application/index.js";
import {
  mapProcessRefundResult,
  mapRejectRefundResult,
  mapRequestRefundResult,
} from "./refund.response.js";
import {
  RefundIdParamsSchema,
  RejectRefundBodySchema,
  RequestRefundBodySchema,
} from "./refund.schemas.js";

export function createRefundRoutes(deps: {
  requestRefundUseCase: RequestRefundUseCase;
  processRefundUseCase: ProcessRefundUseCase;
  rejectRefundUseCase: RejectRefundUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/refunds", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = RequestRefundBodySchema.safeParse(rawBody);

    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid refund request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.requestRefundUseCase({
      orderId: body.data.orderId,
      paymentId: body.data.paymentId,
      amount: {
        amount: body.data.amount,
        currency: body.data.currency,
      },
      reason: body.data.reason,
      returnRequired: body.data.returnRequired,
      restock: body.data.restock,
      idempotencyKey: body.data.idempotencyKey,
    });
    const response = mapRequestRefundResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/refunds/:refundId/process", async (c) => {
    const params = RefundIdParamsSchema.safeParse(c.req.param());

    if (!params.success) {
      return c.json({ error: { type: "InvalidRequest", message: "Invalid refund id" } }, 400);
    }

    const result = await deps.processRefundUseCase({
      refundId: params.data.refundId,
    });
    const response = mapProcessRefundResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/refunds/:refundId/reject", async (c) => {
    const params = RefundIdParamsSchema.safeParse(c.req.param());
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = RejectRefundBodySchema.safeParse(rawBody);

    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid refund rejection request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.rejectRefundUseCase({
      refundId: params.data.refundId,
      reason: body.data.reason,
    });
    const response = mapRejectRefundResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
