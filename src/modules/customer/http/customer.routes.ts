import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type {
  CloseCustomerUseCase,
  ReactivateCustomerUseCase,
  RegisterCustomerUseCase,
  SuspendCustomerUseCase,
} from "../application/index.js";
import {
  mapCloseCustomerResult,
  mapReactivateCustomerResult,
  mapRegisterCustomerResult,
  mapSuspendCustomerResult,
} from "./customer.response.js";
import {
  CustomerParamsSchema,
  CustomerReasonBodySchema,
  RegisterCustomerBodySchema,
} from "./customer.schemas.js";

export function createCustomerRoutes(deps: {
  registerCustomerUseCase: RegisterCustomerUseCase;
  suspendCustomerUseCase: SuspendCustomerUseCase;
  reactivateCustomerUseCase: ReactivateCustomerUseCase;
  closeCustomerUseCase: CloseCustomerUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/customers", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = RegisterCustomerBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid customer registration request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.registerCustomerUseCase(body.data);
    const response = mapRegisterCustomerResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/customers/:customerId/suspend", async (c) => {
    const params = CustomerParamsSchema.safeParse(c.req.param());
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = CustomerReasonBodySchema.safeParse(rawBody);
    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid customer suspension request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.suspendCustomerUseCase({
      customerId: params.data.customerId,
      reason: body.data.reason,
    });
    const response = mapSuspendCustomerResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/customers/:customerId/reactivate", async (c) => {
    const params = CustomerParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid customer reactivation request",
            params: params.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.reactivateCustomerUseCase({
      customerId: params.data.customerId,
    });
    const response = mapReactivateCustomerResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/customers/:customerId/close", async (c) => {
    const params = CustomerParamsSchema.safeParse(c.req.param());
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = CustomerReasonBodySchema.safeParse(rawBody);
    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid customer closure request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.closeCustomerUseCase({
      customerId: params.data.customerId,
      reason: body.data.reason,
    });
    const response = mapCloseCustomerResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
