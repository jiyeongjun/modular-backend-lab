import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { AuthorizationEvent, AuthorizationRole, RoleGrant } from "../domain/index.js";
import type { AuthorizationRepository } from "../ports/index.js";
import { toRoleGrant, toRoleGrantInsert, toRoleGrantUpdate } from "./authorization.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyAuthorizationRepository(db: DbExecutor): AuthorizationRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("authorization_role_grants")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toRoleGrant(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("authorization_role_grants")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toRoleGrant(row) : null;
    },

    async findByIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("authorization_role_grants")
        .selectAll()
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toRoleGrant(row) : null;
    },

    async findActiveByActorId(actorId) {
      const rows = await db
        .selectFrom("authorization_role_grants")
        .selectAll()
        .where("actor_id", "=", actorId)
        .where("status", "=", "ACTIVE")
        .orderBy("granted_at", "asc")
        .execute();
      return rows.map(toRoleGrant);
    },

    async findActiveByActorAndRole(actorId, role: AuthorizationRole) {
      const row = await db
        .selectFrom("authorization_role_grants")
        .selectAll()
        .where("actor_id", "=", actorId)
        .where("role", "=", role)
        .where("status", "=", "ACTIVE")
        .executeTakeFirst();
      return row ? toRoleGrant(row) : null;
    },

    async create(grant, events) {
      await appendDomainEvents(db, events, -1);
      await db.insertInto("authorization_role_grants").values(toRoleGrantInsert(grant)).execute();
    },

    async save(grant: RoleGrant, events: readonly AuthorizationEvent[]) {
      if (events.length === 0) {
        return;
      }

      const result = await db
        .updateTable("authorization_role_grants")
        .set({
          ...toRoleGrantUpdate(grant),
          version: grant.version + events.length,
        })
        .where("id", "=", grant.id)
        .where("version", "=", grant.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(
          `Authorization role grant ${grant.id} has a stale version`,
        );
      }

      await appendDomainEvents(db, events, grant.version);
    },
  };
}
