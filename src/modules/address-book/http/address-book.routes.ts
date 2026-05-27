import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type {
  AddAddressUseCase,
  DisableAddressUseCase,
  SetDefaultAddressUseCase,
  UpdateAddressUseCase,
} from "../application/index.js";
import {
  mapAddAddressResult,
  mapDisableAddressResult,
  mapSetDefaultAddressResult,
  mapUpdateAddressResult,
} from "./address-book.response.js";
import {
  AddAddressBodySchema,
  AddressParamsSchema,
  DisableAddressBodySchema,
  UpdateAddressBodySchema,
} from "./address-book.schemas.js";

export function createAddressBookRoutes(deps: {
  addAddressUseCase: AddAddressUseCase;
  updateAddressUseCase: UpdateAddressUseCase;
  setDefaultAddressUseCase: SetDefaultAddressUseCase;
  disableAddressUseCase: DisableAddressUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/address-book/addresses", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = AddAddressBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid address add request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.addAddressUseCase({
      ...body.data,
      label: body.data.label ?? null,
      line2: body.data.line2 ?? null,
      region: body.data.region ?? null,
      makeDefault: body.data.makeDefault ?? false,
    });
    const response = mapAddAddressResult(result);

    return c.json(response.body, response.status);
  });

  app.patch("/address-book/addresses/:addressId", async (c) => {
    const params = AddressParamsSchema.safeParse(c.req.param());
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = UpdateAddressBodySchema.safeParse(rawBody);
    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid address update request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.updateAddressUseCase({
      addressId: params.data.addressId,
      ...body.data,
      label: body.data.label ?? null,
      line2: body.data.line2 ?? null,
      region: body.data.region ?? null,
    });
    const response = mapUpdateAddressResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/address-book/addresses/:addressId/default", async (c) => {
    const params = AddressParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid default address request",
            params: params.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.setDefaultAddressUseCase({
      addressId: params.data.addressId,
    });
    const response = mapSetDefaultAddressResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/address-book/addresses/:addressId/disable", async (c) => {
    const params = AddressParamsSchema.safeParse(c.req.param());
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = DisableAddressBodySchema.safeParse(rawBody);
    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid address disable request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.disableAddressUseCase({
      addressId: params.data.addressId,
      reason: body.data.reason,
    });
    const response = mapDisableAddressResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
