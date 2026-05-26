import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type { CreateNotificationUseCase, SendNotificationUseCase } from "../application/index.js";
import { mapCreateNotificationResult, mapSendNotificationResult } from "./notification.response.js";
import { CreateNotificationBodySchema, NotificationParamsSchema } from "./notification.schemas.js";

export function createNotificationRoutes(deps: {
  createNotificationUseCase: CreateNotificationUseCase;
  sendNotificationUseCase: SendNotificationUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/notifications", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = CreateNotificationBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid notification request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.createNotificationUseCase(body.data);
    const response = mapCreateNotificationResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/notifications/:notificationId/send", async (c) => {
    const params = NotificationParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid notification send request",
            params: params.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.sendNotificationUseCase({
      notificationId: params.data.notificationId,
    });
    const response = mapSendNotificationResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
