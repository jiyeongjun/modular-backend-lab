import { z } from "zod";

export const AuthorizationRoleSchema = z.enum([
  "CUSTOMER",
  "SUPPORT_AGENT",
  "REFUND_MANAGER",
  "MARKETING_MANAGER",
  "FINANCE_OPERATOR",
  "OPERATIONS_MANAGER",
  "ADMIN",
]);

export const AuthorizationPermissionSchema = z.enum([
  "support-ticket:create",
  "support-ticket:assign",
  "support-ticket:resolve",
  "refund:review",
  "promotion:manage",
  "settlement:sync",
  "inventory:adjust",
  "fulfillment:manage",
  "customer:manage",
  "authorization:manage",
]);

export const AuthorizationResourceSchema = z.object({
  type: z.enum([
    "GLOBAL",
    "CUSTOMER",
    "ORDER",
    "SUPPORT_TICKET",
    "REFUND",
    "COUPON",
    "SETTLEMENT",
    "INVENTORY",
    "FULFILLMENT",
  ]),
  id: z.string().trim().min(1).nullable().optional(),
});

export const AuthorizationRoleGrantParamsSchema = z.object({
  grantId: z.string().trim().min(1),
});

export const GrantAuthorizationRoleBodySchema = z.object({
  actorId: z.string().trim().min(1),
  role: AuthorizationRoleSchema,
  idempotencyKey: z.string().trim().min(1),
  grantedByActorId: z.string().trim().min(1),
  grantReason: z.string().trim().min(1).nullable().optional(),
});

export const RevokeAuthorizationRoleBodySchema = z.object({
  revokedByActorId: z.string().trim().min(1),
  revokeReason: z.string().trim().min(1),
});

export const CheckAuthorizationBodySchema = z.object({
  actorId: z.string().trim().min(1),
  permission: AuthorizationPermissionSchema,
  resource: AuthorizationResourceSchema,
});
