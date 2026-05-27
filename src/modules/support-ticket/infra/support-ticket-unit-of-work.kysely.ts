import type { Db } from "../../../infra/db/db.js";
import type { SupportTicketUnitOfWork } from "../ports/index.js";
import { createKyselySupportTicketRepository } from "./support-ticket.repository.kysely.js";
import { createKyselySupportTicketOutboxRepository } from "./support-ticket-outbox.repository.kysely.js";

export function createKyselySupportTicketUnitOfWork(db: Db): SupportTicketUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          tickets: createKyselySupportTicketRepository(trx),
          outbox: createKyselySupportTicketOutboxRepository(trx),
        }),
      );
    },
  };
}
