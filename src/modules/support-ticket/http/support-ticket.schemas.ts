import { z } from "zod";

export const SupportTicketParamsSchema = z.object({
  ticketId: z.string().trim().min(1),
});

export const CreateSupportTicketBodySchema = z.object({
  customerId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1),
  category: z.enum(["ORDER", "PAYMENT", "FULFILLMENT", "RETURN", "REFUND", "ACCOUNT", "OTHER"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  subject: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(5000),
  orderId: z.string().trim().min(1).nullable().optional(),
  returnId: z.string().trim().min(1).nullable().optional(),
  refundId: z.string().trim().min(1).nullable().optional(),
});

export const AssignSupportTicketBodySchema = z.object({
  assigneeId: z.string().trim().min(1).max(200),
});

export const ResolveSupportTicketBodySchema = z.object({
  resolution: z.string().trim().min(1).max(5000),
});
