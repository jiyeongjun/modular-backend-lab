import type {
  AuthorizationRoleGrantInsert,
  AuthorizationRoleGrantRow,
  AuthorizationRoleGrantUpdate,
} from "../../../infra/db/database.js";
import type {
  ActiveRoleGrant,
  AuthorizationRole,
  RevokedRoleGrant,
  RoleGrant,
  RoleGrantStatus,
} from "../domain/index.js";

function toRole(value: string): AuthorizationRole {
  switch (value) {
    case "CUSTOMER":
    case "SUPPORT_AGENT":
    case "REFUND_MANAGER":
    case "MARKETING_MANAGER":
    case "FINANCE_OPERATOR":
    case "OPERATIONS_MANAGER":
    case "ADMIN":
      return value;
  }

  throw new Error(`Unknown authorization role: ${value}`);
}

function toStatus(value: string): RoleGrantStatus {
  switch (value) {
    case "ACTIVE":
    case "REVOKED":
      return value;
  }

  throw new Error(`Unknown authorization role grant status: ${value}`);
}

function base(row: AuthorizationRoleGrantRow) {
  return {
    id: row.id,
    actorId: row.actor_id,
    role: toRole(row.role),
    idempotencyKey: row.idempotency_key,
    grantedByActorId: row.granted_by_actor_id,
    grantReason: row.grant_reason,
    grantedAt: row.granted_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toRoleGrant(row: AuthorizationRoleGrantRow): RoleGrant {
  switch (toStatus(row.status)) {
    case "ACTIVE": {
      if (
        row.revoked_by_actor_id !== null ||
        row.revoke_reason !== null ||
        row.revoked_at !== null
      ) {
        throw new Error(`Active authorization role grant ${row.id} has revoked columns`);
      }

      const grant: ActiveRoleGrant = {
        ...base(row),
        status: "ACTIVE",
        revokedByActorId: null,
        revokeReason: null,
        revokedAt: null,
      };
      return grant;
    }

    case "REVOKED": {
      if (
        row.revoked_by_actor_id === null ||
        row.revoke_reason === null ||
        row.revoked_at === null
      ) {
        throw new Error(`Revoked authorization role grant ${row.id} has invalid columns`);
      }

      const grant: RevokedRoleGrant = {
        ...base(row),
        status: "REVOKED",
        revokedByActorId: row.revoked_by_actor_id,
        revokeReason: row.revoke_reason,
        revokedAt: row.revoked_at,
      };
      return grant;
    }
  }
}

export function toRoleGrantInsert(grant: RoleGrant): AuthorizationRoleGrantInsert {
  return {
    id: grant.id,
    actor_id: grant.actorId,
    role: grant.role,
    idempotency_key: grant.idempotencyKey,
    status: grant.status,
    granted_by_actor_id: grant.grantedByActorId,
    grant_reason: grant.grantReason,
    revoked_by_actor_id: grant.revokedByActorId,
    revoke_reason: grant.revokeReason,
    granted_at: grant.grantedAt,
    revoked_at: grant.revokedAt,
    version: grant.version,
    created_at: grant.createdAt,
    updated_at: grant.updatedAt,
  };
}

export function toRoleGrantUpdate(grant: RoleGrant): AuthorizationRoleGrantUpdate {
  return {
    status: grant.status,
    revoked_by_actor_id: grant.revokedByActorId,
    revoke_reason: grant.revokeReason,
    revoked_at: grant.revokedAt,
    updated_at: grant.updatedAt,
  };
}
