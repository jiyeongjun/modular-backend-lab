import { z } from "zod";

const NotificationPayloadValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const CreateNotificationBodySchema = z.object({
  idempotencyKey: z.string().trim().min(1),
  channel: z.enum(["EMAIL", "SMS", "SLACK", "WEBHOOK"]),
  recipient: z.string().trim().min(1),
  templateKey: z.string().trim().min(1),
  payload: z.record(z.string(), NotificationPayloadValueSchema),
});

export const NotificationParamsSchema = z.object({
  notificationId: z.string().trim().min(1),
});
