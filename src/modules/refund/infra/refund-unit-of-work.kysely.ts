import type { Db } from "../../../infra/db/db.js";
import type { RefundUnitOfWork } from "../ports/index.js";
import { createKyselyRefundRepository } from "./refund.repository.kysely.js";
import { createKyselyRefundOutboxRepository } from "./refund-outbox.repository.kysely.js";

export function createKyselyRefundUnitOfWork(db: Db): RefundUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          refunds: createKyselyRefundRepository(trx),
          outbox: createKyselyRefundOutboxRepository(trx),
        }),
      );
    },
  };
}
