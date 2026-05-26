import { z } from "zod";

export const SubmitCheckoutBodySchema = z.object({
  orderId: z
    .string()
    .min(6)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
  sku: z.string().min(1).max(80),
  quantity: z.number().int().positive(),
  paymentKey: z.string().min(1).max(300),
  amount: z.number().int().positive(),
  currency: z.enum(["KRW", "USD"]),
  idempotencyKey: z.string().min(1).max(300),
});
