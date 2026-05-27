import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type { AppendAuditRecordUseCase } from "../application/index.js";
import { mapAppendAuditRecordResult } from "./audit-log.response.js";
import { AppendAuditRecordBodySchema } from "./audit-log.schemas.js";

export function createAuditLogRoutes(deps: {
  appendAuditRecordUseCase: AppendAuditRecordUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/audit-log/records", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = AppendAuditRecordBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid audit record append request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.appendAuditRecordUseCase({
      idempotencyKey: body.data.idempotencyKey,
      actorId: body.data.actorId,
      action: body.data.action,
      resourceType: body.data.resourceType,
      resourceId: body.data.resourceId ?? null,
      result: body.data.result,
      reason: body.data.reason ?? null,
      requestId: body.data.requestId ?? null,
      metadata: body.data.metadata ?? {},
      occurredAt: body.data.occurredAt ?? new Date(),
    });
    const response = mapAppendAuditRecordResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
