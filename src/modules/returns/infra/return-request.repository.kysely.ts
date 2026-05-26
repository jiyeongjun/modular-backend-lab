import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { ReturnRequest, ReturnRequestEvent } from "../domain/index.js";
import type { ReturnRequestRepository } from "../ports/index.js";
import {
  toReturnRequest,
  toReturnRequestInsert,
  toReturnRequestUpdate,
} from "./return-request.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyReturnRequestRepository(db: DbExecutor): ReturnRequestRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("return_requests")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toReturnRequest(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("return_requests")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toReturnRequest(row) : null;
    },

    async findByIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("return_requests")
        .selectAll()
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toReturnRequest(row) : null;
    },

    async create(returnRequest, events) {
      await appendDomainEvents(db, events, -1);
      await db.insertInto("return_requests").values(toReturnRequestInsert(returnRequest)).execute();
    },

    async save(returnRequest: ReturnRequest, events: readonly ReturnRequestEvent[]) {
      if (events.length === 0) {
        return;
      }

      const result = await db
        .updateTable("return_requests")
        .set({
          ...toReturnRequestUpdate(returnRequest),
          version: returnRequest.version + events.length,
        })
        .where("id", "=", returnRequest.id)
        .where("version", "=", returnRequest.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(
          `Return request ${returnRequest.id} has a stale version`,
        );
      }

      await appendDomainEvents(db, events, returnRequest.version);
    },
  };
}
