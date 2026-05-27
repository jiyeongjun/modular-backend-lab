import { z } from "zod";

const AuditMetadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const AppendAuditRecordBodySchema = z.object({
  idempotencyKey: z.string().trim().min(1),
  actorId: z.string().trim().min(1),
  action: z.string().trim().min(1),
  resourceType: z.string().trim().min(1),
  resourceId: z.string().trim().min(1).nullable().optional(),
  result: z.enum(["SUCCESS", "DENIED", "FAILED"]),
  reason: z.string().trim().min(1).nullable().optional(),
  requestId: z.string().trim().min(1).nullable().optional(),
  metadata: z.record(z.string(), AuditMetadataValueSchema).optional(),
  occurredAt: z.coerce.date().optional(),
});
