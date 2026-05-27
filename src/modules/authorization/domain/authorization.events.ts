import type { AuthorizationRole } from "./authorization.js";

export type AuthorizationRoleGrantedEvent = Readonly<{
  type: "AuthorizationRoleGranted";
  aggregateType: "AuthorizationRoleGrant";
  aggregateId: string;
  occurredAt: Date;
  payload: Readonly<{
    grantId: string;
    actorId: string;
    role: AuthorizationRole;
    idempotencyKey: string;
    grantedByActorId: string;
    grantReason: string | null;
    grantedAt: Date;
  }>;
}>;

export type AuthorizationRoleRevokedEvent = Readonly<{
  type: "AuthorizationRoleRevoked";
  aggregateType: "AuthorizationRoleGrant";
  aggregateId: string;
  occurredAt: Date;
  payload: Readonly<{
    grantId: string;
    actorId: string;
    role: AuthorizationRole;
    revokedByActorId: string;
    revokeReason: string;
    revokedAt: Date;
  }>;
}>;

export type AuthorizationEvent = AuthorizationRoleGrantedEvent | AuthorizationRoleRevokedEvent;
