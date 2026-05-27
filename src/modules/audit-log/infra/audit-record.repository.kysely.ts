import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import type { AuditRecord, AuditRecordEvent } from "../domain/index.js";
import type { AuditRecordRepository } from "../ports/index.js";
import { toAuditRecord, toAuditRecordInsert } from "./audit-record.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyAuditRecordRepository(db: DbExecutor): AuditRecordRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("audit_log_records")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toAuditRecord(row) : null;
    },

    async findByIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("audit_log_records")
        .selectAll()
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toAuditRecord(row) : null;
    },

    async create(record: AuditRecord, events: readonly AuditRecordEvent[]) {
      await appendDomainEvents(db, events, -1);
      await db.insertInto("audit_log_records").values(toAuditRecordInsert(record)).execute();
    },
  };
}
