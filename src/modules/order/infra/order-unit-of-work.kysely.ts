import type { Db } from "../../../infra/db/db.js";
import type { OrderUnitOfWork } from "../ports/index.js";
import { createKyselyOrderRepository } from "./order.repository.kysely.js";
import { createKyselyOutboxRepository } from "./outbox.repository.kysely.js";

export function createKyselyOrderUnitOfWork(db: Db): OrderUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          orders: createKyselyOrderRepository(trx),
          outbox: createKyselyOutboxRepository(trx),
        }),
      );
    },
  };
}
