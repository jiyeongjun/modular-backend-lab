import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { AuthEvent, EmailCredential } from "../domain/index.js";
import type { AuthCredentialRepository } from "../ports/index.js";
import {
  toEmailCredential,
  toEmailCredentialInsert,
  toEmailCredentialUpdate,
} from "./auth-credential.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyAuthCredentialRepository(db: DbExecutor): AuthCredentialRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("auth_email_credentials")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toEmailCredential(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("auth_email_credentials")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toEmailCredential(row) : null;
    },

    async findByEmail(email) {
      const row = await db
        .selectFrom("auth_email_credentials")
        .selectAll()
        .where("email", "=", email)
        .executeTakeFirst();
      return row ? toEmailCredential(row) : null;
    },

    async findByEmailForUpdate(email) {
      const row = await db
        .selectFrom("auth_email_credentials")
        .selectAll()
        .where("email", "=", email)
        .forUpdate()
        .executeTakeFirst();
      return row ? toEmailCredential(row) : null;
    },

    async findByIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("auth_email_credentials")
        .selectAll()
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toEmailCredential(row) : null;
    },

    async create(credential, events) {
      await appendDomainEvents(db, events, -1);
      await db
        .insertInto("auth_email_credentials")
        .values(toEmailCredentialInsert(credential))
        .execute();
    },

    async save(credential: EmailCredential, events: readonly AuthEvent[]) {
      if (events.length === 0) {
        return;
      }

      const result = await db
        .updateTable("auth_email_credentials")
        .set({
          ...toEmailCredentialUpdate(credential),
          version: credential.version + events.length,
        })
        .where("id", "=", credential.id)
        .where("version", "=", credential.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(
          `Auth credential ${credential.id} has a stale version`,
        );
      }

      await appendDomainEvents(db, events, credential.version);
    },
  };
}
