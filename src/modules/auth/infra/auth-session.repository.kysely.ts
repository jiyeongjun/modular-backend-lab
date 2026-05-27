import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { AuthEvent, AuthSession } from "../domain/index.js";
import type { AuthSessionRepository } from "../ports/index.js";
import { toAuthSession, toAuthSessionInsert, toAuthSessionUpdate } from "./auth-session.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyAuthSessionRepository(db: DbExecutor): AuthSessionRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("auth_sessions")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toAuthSession(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("auth_sessions")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toAuthSession(row) : null;
    },

    async findByTokenHash(tokenHash) {
      const row = await db
        .selectFrom("auth_sessions")
        .selectAll()
        .where("token_hash", "=", tokenHash)
        .executeTakeFirst();
      return row ? toAuthSession(row) : null;
    },

    async findByTokenHashForUpdate(tokenHash) {
      const row = await db
        .selectFrom("auth_sessions")
        .selectAll()
        .where("token_hash", "=", tokenHash)
        .forUpdate()
        .executeTakeFirst();
      return row ? toAuthSession(row) : null;
    },

    async create(session, events) {
      await appendDomainEvents(db, events, -1);
      await db.insertInto("auth_sessions").values(toAuthSessionInsert(session)).execute();
    },

    async save(session: AuthSession, events: readonly AuthEvent[]) {
      if (events.length === 0) {
        return;
      }

      const result = await db
        .updateTable("auth_sessions")
        .set({
          ...toAuthSessionUpdate(session),
          version: session.version + events.length,
        })
        .where("id", "=", session.id)
        .where("version", "=", session.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Auth session ${session.id} has a stale version`);
      }

      await appendDomainEvents(db, events, session.version);
    },
  };
}
