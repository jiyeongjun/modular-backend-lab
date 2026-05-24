import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type { PayOrderUseCase } from "../application/index.js";
import { mapPayOrderResult } from "./order.response.js";
import { PayOrderParamsSchema } from "./order.schemas.js";

export function createOrderRoutes(deps: { payOrderUseCase: PayOrderUseCase }): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/orders/:orderId/pay", async (c) => {
    const params = PayOrderParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid order id",
            details: params.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.payOrderUseCase({ orderId: params.data.orderId });
    const response = mapPayOrderResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
