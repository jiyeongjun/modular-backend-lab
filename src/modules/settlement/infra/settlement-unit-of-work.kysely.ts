import type { Db } from "../../../infra/db/db.js";
import type { SettlementUnitOfWork } from "../ports/index.js";
import { createKyselySettlementRepository } from "./settlement.repository.kysely.js";
import { createKyselySettlementOutboxRepository } from "./settlement-outbox.repository.kysely.js";

export function createKyselySettlementUnitOfWork(db: Db): SettlementUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          settlements: createKyselySettlementRepository(trx),
          outbox: createKyselySettlementOutboxRepository(trx),
        }),
      );
    },
  };
}
