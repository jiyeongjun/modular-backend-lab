import { z } from "zod";

export const CustomerParamsSchema = z.object({
  customerId: z.string().trim().min(1),
});

export const RegisterCustomerBodySchema = z.object({
  idempotencyKey: z.string().trim().min(1),
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1).max(200),
});

export const CustomerReasonBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
