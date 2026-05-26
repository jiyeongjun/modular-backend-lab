import type { Db } from "../../../infra/db/db.js";
import type { ReturnsUnitOfWork } from "../ports/index.js";
import { createKyselyReturnRequestRepository } from "./return-request.repository.kysely.js";
import { createKyselyReturnsOutboxRepository } from "./returns-outbox.repository.kysely.js";

export function createKyselyReturnsUnitOfWork(db: Db): ReturnsUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          returns: createKyselyReturnRequestRepository(trx),
          outbox: createKyselyReturnsOutboxRepository(trx),
        }),
      );
    },
  };
}
