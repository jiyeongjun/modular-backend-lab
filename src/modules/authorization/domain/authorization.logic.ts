import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  GrantAuthorizationRoleError,
  InvalidAuthorizationInput,
  RevokeAuthorizationRoleError,
} from "./authorization.errors.js";
import type { AuthorizationEvent } from "./authorization.events.js";
import type {
  ActiveRoleGrant,
  AuthorizationDecision,
  AuthorizationPermission,
  AuthorizationRequest,
  AuthorizationRole,
  RevokedRoleGrant,
  RoleGrant,
} from "./authorization.js";

const ROLE_PERMISSIONS: Record<AuthorizationRole, readonly AuthorizationPermission[]> = {
  CUSTOMER: ["support-ticket:create"],
  SUPPORT_AGENT: ["support-ticket:create", "support-ticket:assign", "support-ticket:resolve"],
  REFUND_MANAGER: ["refund:review"],
  MARKETING_MANAGER: ["promotion:manage"],
  FINANCE_OPERATOR: ["settlement:sync"],
  OPERATIONS_MANAGER: ["inventory:adjust", "fulfillment:manage"],
  ADMIN: [
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
  ],
};

export type GrantAuthorizationRoleInput = Readonly<{
  id: string;
  actorId: string;
  role: AuthorizationRole;
  idempotencyKey: string;
  grantedByActorId: string;
  grantReason: string | null;
  now: Date;
}>;

export type RevokeAuthorizationRoleInput = Readonly<{
  revokedByActorId: string;
  revokeReason: string;
  now: Date;
}>;

export type RoleGrantTransition<T extends RoleGrant> = Readonly<{
  grant: T;
  events: readonly AuthorizationEvent[];
}>;

export function grantAuthorizationRole(
  input: GrantAuthorizationRoleInput,
): Result<ActiveRoleGrant, GrantAuthorizationRoleError> {
  const invalidInput = validateRequiredFields([
    ["id", input.id],
    ["actorId", input.actorId],
    ["idempotencyKey", input.idempotencyKey],
    ["grantedByActorId", input.grantedByActorId],
  ]);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  return ok({
    id: input.id.trim(),
    actorId: input.actorId.trim(),
    role: input.role,
    idempotencyKey: input.idempotencyKey.trim(),
    grantedByActorId: input.grantedByActorId.trim(),
    grantReason: normalizeNullable(input.grantReason),
    status: "ACTIVE",
    revokedByActorId: null,
    revokeReason: null,
    grantedAt: input.now,
    revokedAt: null,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function authorizationRoleGrantedEvent(grant: ActiveRoleGrant): AuthorizationEvent {
  return {
    type: "AuthorizationRoleGranted",
    aggregateType: "AuthorizationRoleGrant",
    aggregateId: grant.id,
    occurredAt: grant.grantedAt,
    payload: {
      grantId: grant.id,
      actorId: grant.actorId,
      role: grant.role,
      idempotencyKey: grant.idempotencyKey,
      grantedByActorId: grant.grantedByActorId,
      grantReason: grant.grantReason,
      grantedAt: grant.grantedAt,
    },
  };
}

export function revokeAuthorizationRole(
  grant: RoleGrant,
  input: RevokeAuthorizationRoleInput,
): Result<RoleGrantTransition<RevokedRoleGrant>, RevokeAuthorizationRoleError> {
  const invalidInput = validateRequiredFields([
    ["revokedByActorId", input.revokedByActorId],
    ["revokeReason", input.revokeReason],
  ]);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  switch (grant.status) {
    case "ACTIVE": {
      const revoked: RevokedRoleGrant = {
        ...grant,
        status: "REVOKED",
        revokedByActorId: input.revokedByActorId.trim(),
        revokeReason: input.revokeReason.trim(),
        revokedAt: input.now,
        updatedAt: input.now,
      };

      return ok({
        grant: revoked,
        events: [
          {
            type: "AuthorizationRoleRevoked",
            aggregateType: "AuthorizationRoleGrant",
            aggregateId: revoked.id,
            occurredAt: input.now,
            payload: {
              grantId: revoked.id,
              actorId: revoked.actorId,
              role: revoked.role,
              revokedByActorId: revoked.revokedByActorId,
              revokeReason: revoked.revokeReason,
              revokedAt: revoked.revokedAt,
            },
          },
        ],
      });
    }

    case "REVOKED":
      return ok({ grant, events: [] });
  }
}

export function evaluateAuthorization(
  grants: readonly RoleGrant[],
  request: AuthorizationRequest,
): AuthorizationDecision {
  const matchedGrant = grants.find(
    (grant) =>
      grant.status === "ACTIVE" &&
      grant.actorId === request.actorId &&
      ROLE_PERMISSIONS[grant.role].includes(request.permission),
  );

  if (matchedGrant !== undefined) {
    return {
      allowed: true,
      actorId: request.actorId,
      permission: request.permission,
      resource: request.resource,
      matchedRole: matchedGrant.role,
      reason: "RoleAllowsPermission",
    };
  }

  return {
    allowed: false,
    actorId: request.actorId,
    permission: request.permission,
    resource: request.resource,
    matchedRole: null,
    reason: "NoActiveRoleAllowsPermission",
  };
}

function normalizeNullable(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function validateRequiredFields(
  entries: readonly (readonly [InvalidAuthorizationInput["field"], string])[],
): InvalidAuthorizationInput | null {
  for (const [field, value] of entries) {
    if (value.trim().length === 0) {
      return {
        type: "InvalidAuthorizationInput",
        field,
        message: `Authorization ${field} is required`,
      };
    }
  }

  return null;
}
