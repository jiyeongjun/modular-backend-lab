import type { Db } from "../../../infra/db/db.js";
import type { CustomerUnitOfWork } from "../ports/index.js";
import { createKyselyCustomerRepository } from "./customer.repository.kysely.js";
import { createKyselyCustomerOutboxRepository } from "./customer-outbox.repository.kysely.js";

export function createKyselyCustomerUnitOfWork(db: Db): CustomerUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          customers: createKyselyCustomerRepository(trx),
          outbox: createKyselyCustomerOutboxRepository(trx),
        }),
      );
    },
  };
}
