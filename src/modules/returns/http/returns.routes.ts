import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type {
  AuthorizeReturnUseCase,
  CreateReturnRequestUseCase,
  InspectReturnUseCase,
  ReceiveReturnUseCase,
} from "../application/index.js";
import {
  mapAuthorizeReturnResult,
  mapCreateReturnRequestResult,
  mapInspectReturnResult,
  mapReceiveReturnResult,
} from "./returns.response.js";
import {
  CreateReturnRequestBodySchema,
  InspectReturnBodySchema,
  ReturnRequestParamsSchema,
} from "./returns.schemas.js";

export function createReturnsRoutes(deps: {
  createReturnRequestUseCase: CreateReturnRequestUseCase;
  authorizeReturnUseCase: AuthorizeReturnUseCase;
  receiveReturnUseCase: ReceiveReturnUseCase;
  inspectReturnUseCase: InspectReturnUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/returns", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = CreateReturnRequestBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid return request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.createReturnRequestUseCase(body.data);
    const response = mapCreateReturnRequestResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/returns/:returnId/authorize", async (c) => {
    const params = ReturnRequestParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid return authorization request",
            params: params.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.authorizeReturnUseCase({ returnId: params.data.returnId });
    const response = mapAuthorizeReturnResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/returns/:returnId/receive", async (c) => {
    const params = ReturnRequestParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid return receipt request",
            params: params.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.receiveReturnUseCase({ returnId: params.data.returnId });
    const response = mapReceiveReturnResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/returns/:returnId/inspect", async (c) => {
    const params = ReturnRequestParamsSchema.safeParse(c.req.param());
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = InspectReturnBodySchema.safeParse(rawBody);
    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid return inspection request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.inspectReturnUseCase({
      returnId: params.data.returnId,
      accepted: body.data.accepted,
      restockableItems: body.data.restockableItems ?? [],
      note: body.data.note ?? null,
      rejectionReason: body.data.rejectionReason ?? null,
    });
    const response = mapInspectReturnResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
