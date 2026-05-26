import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type {
  CommitReservationUseCase,
  ReleaseReservationUseCase,
  ReserveInventoryUseCase,
} from "../application/index.js";
import { mapReservationCommandResult, mapReserveInventoryResult } from "./inventory.response.js";
import {
  ReservationParamsSchema,
  ReserveInventoryBodySchema,
  ReserveInventoryParamsSchema,
} from "./inventory.schemas.js";

export function createInventoryRoutes(deps: {
  reserveInventoryUseCase: ReserveInventoryUseCase;
  releaseReservationUseCase: ReleaseReservationUseCase;
  commitReservationUseCase: CommitReservationUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/inventory/:sku/reservations", async (c) => {
    const params = ReserveInventoryParamsSchema.safeParse(c.req.param());
    const body = ReserveInventoryBodySchema.safeParse(await c.req.json());

    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid inventory reservation request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.reserveInventoryUseCase({
      sku: params.data.sku,
      quantity: body.data.quantity,
      idempotencyKey: body.data.idempotencyKey,
      expiresAt: body.data.expiresAt,
    });
    const response = mapReserveInventoryResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/inventory/reservations/:reservationId/release", async (c) => {
    const params = ReservationParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid reservation id",
            details: params.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.releaseReservationUseCase({
      reservationId: params.data.reservationId,
    });
    const response = mapReservationCommandResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/inventory/reservations/:reservationId/commit", async (c) => {
    const params = ReservationParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid reservation id",
            details: params.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.commitReservationUseCase({
      reservationId: params.data.reservationId,
    });
    const response = mapReservationCommandResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
