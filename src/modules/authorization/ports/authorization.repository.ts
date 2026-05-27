import type { AuthorizationEvent, AuthorizationRole, RoleGrant } from "../domain/index.js";

export type AuthorizationRepository = {
  findById(id: string): Promise<RoleGrant | null>;
  findByIdForUpdate(id: string): Promise<RoleGrant | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<RoleGrant | null>;
  findActiveByActorId(actorId: string): Promise<readonly RoleGrant[]>;
  findActiveByActorAndRole(actorId: string, role: AuthorizationRole): Promise<RoleGrant | null>;
  create(grant: RoleGrant, events: readonly AuthorizationEvent[]): Promise<void>;
  save(grant: RoleGrant, events: readonly AuthorizationEvent[]): Promise<void>;
};
