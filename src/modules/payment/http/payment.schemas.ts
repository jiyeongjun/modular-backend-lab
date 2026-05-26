import { z } from "zod";

export const ConfirmPaymentBodySchema = z.object({
  orderId: z
    .string()
    .min(6)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
  paymentKey: z.string().min(1).max(300),
  amount: z.number().int().positive(),
  currency: z.enum(["KRW", "USD"]),
  idempotencyKey: z.string().min(1).max(300),
});

export const PaymentParamsSchema = z.object({
  paymentId: z.string().min(1).max(120),
});

export const CancelPaymentBodySchema = z.object({
  idempotencyKey: z.string().min(1).max(300),
  reason: z.string().min(1).max(200),
});
