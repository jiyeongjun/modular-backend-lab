import type { Db } from "../../../infra/db/db.js";
import type { FulfillmentUnitOfWork } from "../ports/index.js";
import { createKyselyFulfillmentRepository } from "./fulfillment.repository.kysely.js";
import { createKyselyFulfillmentOutboxRepository } from "./fulfillment-outbox.repository.kysely.js";

export function createKyselyFulfillmentUnitOfWork(db: Db): FulfillmentUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          fulfillments: createKyselyFulfillmentRepository(trx),
          outbox: createKyselyFulfillmentOutboxRepository(trx),
        }),
      );
    },
  };
}
