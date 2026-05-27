import type { RoleGrantStatus } from "./authorization.js";

export type InvalidAuthorizationInput = Readonly<{
  type: "InvalidAuthorizationInput";
  field:
    | "id"
    | "actorId"
    | "idempotencyKey"
    | "grantedByActorId"
    | "revokedByActorId"
    | "revokeReason";
  message: string;
}>;

export type RoleGrantNotRevocable = Readonly<{
  type: "RoleGrantNotRevocable";
  status: RoleGrantStatus;
  message: string;
}>;

export type GrantAuthorizationRoleError = InvalidAuthorizationInput;

export type RevokeAuthorizationRoleError = InvalidAuthorizationInput | RoleGrantNotRevocable;
