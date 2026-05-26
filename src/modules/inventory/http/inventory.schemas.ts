import { z } from "zod";

export const ReserveInventoryParamsSchema = z.object({
  sku: z.string().trim().min(1),
});

export const ReserveInventoryBodySchema = z.object({
  quantity: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(1),
  expiresAt: z.coerce.date(),
});

export const ReservationParamsSchema = z.object({
  reservationId: z.string().trim().min(1),
});
