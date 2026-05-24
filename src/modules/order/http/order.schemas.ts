import { z } from "zod";

export const PayOrderParamsSchema = z.object({
  orderId: z.string().trim().min(1),
});
