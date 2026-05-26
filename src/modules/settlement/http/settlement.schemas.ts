import { z } from "zod";

export const SettlementParamsSchema = z.object({
  orderId: z.string().min(1),
});

export const SyncSettlementBodySchema = z.object({
  orderId: z.string().min(1),
});
