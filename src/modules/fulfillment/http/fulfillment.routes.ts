import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type {
  CancelFulfillmentUseCase,
  CreateFulfillmentUseCase,
  MarkFulfillmentPackedUseCase,
  PurchaseShippingLabelUseCase,
  SyncFulfillmentCarrierStatusUseCase,
} from "../application/index.js";
import {
  mapCancelFulfillmentResult,
  mapCreateFulfillmentResult,
  mapMarkFulfillmentPackedResult,
  mapPurchaseShippingLabelResult,
  mapSyncFulfillmentCarrierStatusResult,
} from "./fulfillment.response.js";
import {
  CancelFulfillmentBodySchema,
  CreateFulfillmentBodySchema,
  FulfillmentIdParamsSchema,
  PurchaseShippingLabelBodySchema,
} from "./fulfillment.schemas.js";

export function createFulfillmentRoutes(deps: {
  createFulfillmentUseCase: CreateFulfillmentUseCase;
  markFulfillmentPackedUseCase: MarkFulfillmentPackedUseCase;
  purchaseShippingLabelUseCase: PurchaseShippingLabelUseCase;
  cancelFulfillmentUseCase: CancelFulfillmentUseCase;
  syncFulfillmentCarrierStatusUseCase: SyncFulfillmentCarrierStatusUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/fulfillments", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = CreateFulfillmentBodySchema.safeParse(rawBody);

    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid fulfillment request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.createFulfillmentUseCase({
      orderId: body.data.orderId,
      idempotencyKey: body.data.idempotencyKey,
      recipient: body.data.recipient,
      package: body.data.package,
    });
    const response = mapCreateFulfillmentResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/fulfillments/:fulfillmentId/pack", async (c) => {
    const params = FulfillmentIdParamsSchema.safeParse(c.req.param());

    if (!params.success) {
      return c.json({ error: { type: "InvalidRequest", message: "Invalid fulfillment id" } }, 400);
    }

    const result = await deps.markFulfillmentPackedUseCase({
      fulfillmentId: params.data.fulfillmentId,
    });
    const response = mapMarkFulfillmentPackedResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/fulfillments/:fulfillmentId/label", async (c) => {
    const params = FulfillmentIdParamsSchema.safeParse(c.req.param());
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = PurchaseShippingLabelBodySchema.safeParse(rawBody);

    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid shipping label request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.purchaseShippingLabelUseCase({
      fulfillmentId: params.data.fulfillmentId,
      idempotencyKey: body.data.idempotencyKey,
    });
    const response = mapPurchaseShippingLabelResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/fulfillments/:fulfillmentId/cancel", async (c) => {
    const params = FulfillmentIdParamsSchema.safeParse(c.req.param());
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = CancelFulfillmentBodySchema.safeParse(rawBody);

    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid fulfillment cancellation request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.cancelFulfillmentUseCase({
      fulfillmentId: params.data.fulfillmentId,
      reason: body.data.reason,
    });
    const response = mapCancelFulfillmentResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/fulfillments/:fulfillmentId/sync-carrier-status", async (c) => {
    const params = FulfillmentIdParamsSchema.safeParse(c.req.param());

    if (!params.success) {
      return c.json({ error: { type: "InvalidRequest", message: "Invalid fulfillment id" } }, 400);
    }

    const result = await deps.syncFulfillmentCarrierStatusUseCase({
      fulfillmentId: params.data.fulfillmentId,
    });
    const response = mapSyncFulfillmentCarrierStatusResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
