import { z } from "zod";

const ReturnItemSchema = z.object({
  sku: z.string().trim().min(1),
  quantity: z.number().int().positive(),
});

export const ReturnRequestParamsSchema = z.object({
  returnId: z.string().trim().min(1),
});

export const CreateReturnRequestBodySchema = z.object({
  orderId: z.string().trim().min(1),
  fulfillmentId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  items: z.array(ReturnItemSchema).min(1),
});

export const InspectReturnBodySchema = z.object({
  accepted: z.boolean(),
  restockableItems: z.array(ReturnItemSchema).optional(),
  note: z.string().trim().min(1).nullable().optional(),
  rejectionReason: z.string().trim().min(1).nullable().optional(),
});
