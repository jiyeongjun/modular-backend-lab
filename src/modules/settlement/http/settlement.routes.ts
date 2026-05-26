import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type { GetSettlementUseCase, SyncSettlementUseCase } from "../application/index.js";
import { mapGetSettlementResult, mapSyncSettlementResult } from "./settlement.response.js";
import { SettlementParamsSchema, SyncSettlementBodySchema } from "./settlement.schemas.js";

export function createSettlementRoutes(deps: {
  syncSettlementUseCase: SyncSettlementUseCase;
  getSettlementUseCase: GetSettlementUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/settlements/sync", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = SyncSettlementBodySchema.safeParse(rawBody);

    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid settlement sync request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.syncSettlementUseCase({ orderId: body.data.orderId });
    const response = mapSyncSettlementResult(result);

    return c.json(response.body, response.status);
  });

  app.get("/settlements/:orderId", async (c) => {
    const params = SettlementParamsSchema.safeParse(c.req.param());

    if (!params.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid settlement lookup request",
            params: params.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.getSettlementUseCase({ orderId: params.data.orderId });
    const response = mapGetSettlementResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
