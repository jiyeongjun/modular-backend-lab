import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type {
  CommitCouponRedemptionUseCase,
  CreateCouponUseCase,
  QuoteCouponUseCase,
  ReleaseCouponRedemptionUseCase,
  ReserveCouponUseCase,
} from "../application/index.js";
import {
  mapCommitCouponRedemptionResult,
  mapCreateCouponResult,
  mapQuoteCouponResult,
  mapReleaseCouponRedemptionResult,
  mapReserveCouponResult,
} from "./promotion.response.js";
import {
  CouponQuoteBodySchema,
  CouponRedemptionParamsSchema,
  CouponReserveBodySchema,
  CreateCouponBodySchema,
  ReleaseCouponRedemptionBodySchema,
} from "./promotion.schemas.js";

export function createPromotionRoutes(deps: {
  createCouponUseCase: CreateCouponUseCase;
  quoteCouponUseCase: QuoteCouponUseCase;
  reserveCouponUseCase: ReserveCouponUseCase;
  commitCouponRedemptionUseCase: CommitCouponRedemptionUseCase;
  releaseCouponRedemptionUseCase: ReleaseCouponRedemptionUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/promotions/coupons", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = CreateCouponBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid coupon creation request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.createCouponUseCase({
      code: body.data.code,
      discount: body.data.discount,
      minOrderAmount: body.data.minOrderAmount,
      eligibleSkus: body.data.eligibleSkus,
      maxRedemptions: body.data.maxRedemptions,
      startsAt: body.data.startsAt,
      expiresAt: body.data.expiresAt,
    });
    const response = mapCreateCouponResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/promotions/coupons/quote", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = CouponQuoteBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid coupon quote request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.quoteCouponUseCase(body.data);
    const response = mapQuoteCouponResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/promotions/coupons/reserve", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = CouponReserveBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid coupon reserve request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.reserveCouponUseCase(body.data);
    const response = mapReserveCouponResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/promotions/coupon-redemptions/:redemptionId/commit", async (c) => {
    const params = CouponRedemptionParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid coupon redemption commit request",
            params: params.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.commitCouponRedemptionUseCase({
      redemptionId: params.data.redemptionId,
    });
    const response = mapCommitCouponRedemptionResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/promotions/coupon-redemptions/:redemptionId/release", async (c) => {
    const params = CouponRedemptionParamsSchema.safeParse(c.req.param());
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = ReleaseCouponRedemptionBodySchema.safeParse(rawBody);
    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid coupon redemption release request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.releaseCouponRedemptionUseCase({
      redemptionId: params.data.redemptionId,
      reason: body.data.reason,
    });
    const response = mapReleaseCouponRedemptionResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
