import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type { SubmitCheckoutUseCase } from "../application/index.js";
import { mapSubmitCheckoutResult } from "./checkout.response.js";
import { SubmitCheckoutBodySchema } from "./checkout.schemas.js";

export function createCheckoutRoutes(deps: {
  submitCheckoutUseCase: SubmitCheckoutUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/checkout/submit", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = SubmitCheckoutBodySchema.safeParse(rawBody);

    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid checkout request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.submitCheckoutUseCase({
      orderId: body.data.orderId,
      sku: body.data.sku,
      quantity: body.data.quantity,
      paymentKey: body.data.paymentKey,
      amount: {
        amount: body.data.amount,
        currency: body.data.currency,
      },
      idempotencyKey: body.data.idempotencyKey,
    });
    const response = mapSubmitCheckoutResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
