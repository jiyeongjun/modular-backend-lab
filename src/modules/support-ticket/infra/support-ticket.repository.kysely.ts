import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { SupportTicket, SupportTicketEvent } from "../domain/index.js";
import type { SupportTicketRepository } from "../ports/index.js";
import {
  toSupportTicket,
  toSupportTicketInsert,
  toSupportTicketUpdate,
} from "./support-ticket.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselySupportTicketRepository(db: DbExecutor): SupportTicketRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("support_tickets")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toSupportTicket(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("support_tickets")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toSupportTicket(row) : null;
    },

    async findByIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("support_tickets")
        .selectAll()
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toSupportTicket(row) : null;
    },

    async create(ticket, events) {
      await appendDomainEvents(db, events, -1);
      await db.insertInto("support_tickets").values(toSupportTicketInsert(ticket)).execute();
    },

    async save(ticket: SupportTicket, events: readonly SupportTicketEvent[]) {
      if (events.length === 0) {
        return;
      }

      const result = await db
        .updateTable("support_tickets")
        .set({
          ...toSupportTicketUpdate(ticket),
          version: ticket.version + events.length,
        })
        .where("id", "=", ticket.id)
        .where("version", "=", ticket.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Support ticket ${ticket.id} has a stale version`);
      }

      await appendDomainEvents(db, events, ticket.version);
    },
  };
}
