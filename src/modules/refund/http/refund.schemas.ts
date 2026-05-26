import { z } from "zod";

export const RefundRestockSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const RequestRefundBodySchema = z
  .object({
    orderId: z.string().min(1),
    paymentId: z.string().min(1),
    amount: z.number().int().positive(),
    currency: z.enum(["KRW", "USD"]),
    reason: z.string().min(1),
    returnRequired: z.boolean(),
    restock: RefundRestockSchema.nullable().default(null),
    idempotencyKey: z.string().min(1),
  })
  .refine((value) => (value.returnRequired ? value.restock !== null : value.restock === null), {
    message: "restock must be present only when returnRequired is true",
    path: ["restock"],
  });

export const RefundIdParamsSchema = z.object({
  refundId: z.string().min(1),
});

export const RejectRefundBodySchema = z.object({
  reason: z.string().min(1),
});
