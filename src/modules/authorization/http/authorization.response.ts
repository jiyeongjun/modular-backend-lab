import type { Result } from "../../../shared/result/index.js";
import type {
  CheckAuthorizationUseCaseResult,
  GrantAuthorizationRoleUseCaseError,
  GrantAuthorizationRoleUseCaseResult,
  RevokeAuthorizationRoleUseCaseError,
  RevokeAuthorizationRoleUseCaseResult,
} from "../application/index.js";
import type { AuthorizationDecision, RoleGrant } from "../domain/index.js";

export type AuthorizationHttpResponseShape = Readonly<{
  status: 200 | 201 | 400 | 404 | 409;
  body: unknown;
}>;

export function serializeRoleGrant(grant: RoleGrant): Record<string, unknown> {
  return {
    id: grant.id,
    actorId: grant.actorId,
    role: grant.role,
    idempotencyKey: grant.idempotencyKey,
    status: grant.status,
    grantedByActorId: grant.grantedByActorId,
    grantReason: grant.grantReason,
    revokedByActorId: grant.revokedByActorId,
    revokeReason: grant.revokeReason,
    grantedAt: grant.grantedAt.toISOString(),
    revokedAt: grant.revokedAt?.toISOString() ?? null,
    version: grant.version,
    createdAt: grant.createdAt.toISOString(),
    updatedAt: grant.updatedAt.toISOString(),
  };
}

export function serializeAuthorizationDecision(
  decision: AuthorizationDecision,
): Record<string, unknown> {
  return {
    allowed: decision.allowed,
    actorId: decision.actorId,
    permission: decision.permission,
    resource: decision.resource,
    matchedRole: decision.matchedRole,
    reason: decision.reason,
  };
}

export function mapGrantAuthorizationRoleResult(
  result: Result<GrantAuthorizationRoleUseCaseResult, GrantAuthorizationRoleUseCaseError>,
): AuthorizationHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializeRoleGrant(result.value.grant),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapAuthorizationError(result.error);
}

export function mapRevokeAuthorizationRoleResult(
  result: Result<RevokeAuthorizationRoleUseCaseResult, RevokeAuthorizationRoleUseCaseError>,
): AuthorizationHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeRoleGrant(result.value.grant),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapAuthorizationError(result.error);
}

export function mapCheckAuthorizationResult(
  result: Result<CheckAuthorizationUseCaseResult, never>,
): AuthorizationHttpResponseShape {
  if (!result.ok) {
    throw new Error("Unexpected authorization check failure");
  }

  return {
    status: 200,
    body: { data: serializeAuthorizationDecision(result.value.decision) },
  };
}

function mapAuthorizationError(
  error: GrantAuthorizationRoleUseCaseError | RevokeAuthorizationRoleUseCaseError,
): AuthorizationHttpResponseShape {
  switch (error.type) {
    case "InvalidAuthorizationInput":
      return { status: 400, body: { error } };

    case "AuthorizationRoleGrantNotFound":
      return { status: 404, body: { error } };

    case "AuthorizationRoleAlreadyGranted":
    case "AuthorizationRoleGrantIdempotencyConflict":
    case "RoleGrantNotRevocable":
      return { status: 409, body: { error } };
  }
}
