export type AuthorizationRole =
  | "CUSTOMER"
  | "SUPPORT_AGENT"
  | "REFUND_MANAGER"
  | "MARKETING_MANAGER"
  | "FINANCE_OPERATOR"
  | "OPERATIONS_MANAGER"
  | "ADMIN";

export type AuthorizationPermission =
  | "support-ticket:create"
  | "support-ticket:assign"
  | "support-ticket:resolve"
  | "refund:review"
  | "promotion:manage"
  | "settlement:sync"
  | "inventory:adjust"
  | "fulfillment:manage"
  | "customer:manage"
  | "authorization:manage";

export type AuthorizationResourceType =
  | "GLOBAL"
  | "CUSTOMER"
  | "ORDER"
  | "SUPPORT_TICKET"
  | "REFUND"
  | "COUPON"
  | "SETTLEMENT"
  | "INVENTORY"
  | "FULFILLMENT";

export type AuthorizationResource = Readonly<{
  type: AuthorizationResourceType;
  id: string | null;
}>;

export type RoleGrantStatus = "ACTIVE" | "REVOKED";

type RoleGrantBase = Readonly<{
  id: string;
  actorId: string;
  role: AuthorizationRole;
  idempotencyKey: string;
  grantedByActorId: string;
  grantReason: string | null;
  grantedAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ActiveRoleGrant = RoleGrantBase &
  Readonly<{
    status: "ACTIVE";
    revokedByActorId: null;
    revokeReason: null;
    revokedAt: null;
  }>;

export type RevokedRoleGrant = RoleGrantBase &
  Readonly<{
    status: "REVOKED";
    revokedByActorId: string;
    revokeReason: string;
    revokedAt: Date;
  }>;

export type RoleGrant = ActiveRoleGrant | RevokedRoleGrant;

export type AuthorizationRequest = Readonly<{
  actorId: string;
  permission: AuthorizationPermission;
  resource: AuthorizationResource;
}>;

export type AuthorizationDecision =
  | Readonly<{
      allowed: true;
      actorId: string;
      permission: AuthorizationPermission;
      resource: AuthorizationResource;
      matchedRole: AuthorizationRole;
      reason: "RoleAllowsPermission";
    }>
  | Readonly<{
      allowed: false;
      actorId: string;
      permission: AuthorizationPermission;
      resource: AuthorizationResource;
      matchedRole: null;
      reason: "NoActiveRoleAllowsPermission";
    }>;
