import { z } from "zod";

const CurrencySchema = z.enum(["KRW", "USD"]);

const MoneyBodySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: CurrencySchema,
});

const PositiveMoneyBodySchema = z.object({
  amount: z.number().int().positive(),
  currency: CurrencySchema,
});

export const CouponDiscountBodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("FIXED_AMOUNT"),
    amount: PositiveMoneyBodySchema,
  }),
  z.object({
    type: z.literal("PERCENTAGE"),
    basisPoints: z.number().int().min(1).max(10_000),
    currency: CurrencySchema,
    maxDiscountAmount: PositiveMoneyBodySchema.nullable(),
  }),
]);

export const CreateCouponBodySchema = z.object({
  code: z.string().min(1),
  discount: CouponDiscountBodySchema,
  minOrderAmount: MoneyBodySchema,
  eligibleSkus: z.array(z.string().min(1)).nullable(),
  maxRedemptions: z.number().int().positive(),
  startsAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
});

export const CouponQuoteBodySchema = z.object({
  code: z.string().min(1),
  orderId: z.string().min(1),
  orderAmount: PositiveMoneyBodySchema,
  skus: z.array(z.string().min(1)).min(1),
});

export const CouponReserveBodySchema = CouponQuoteBodySchema.extend({
  idempotencyKey: z.string().min(1),
});

export const CouponRedemptionParamsSchema = z.object({
  redemptionId: z.string().min(1),
});

export const ReleaseCouponRedemptionBodySchema = z.object({
  reason: z.string().min(1),
});
