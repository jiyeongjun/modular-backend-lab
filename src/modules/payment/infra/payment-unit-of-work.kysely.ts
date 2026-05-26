import type { Db } from "../../../infra/db/db.js";
import type { PaymentUnitOfWork } from "../ports/index.js";
import { createKyselyPaymentRepository } from "./payment.repository.kysely.js";
import { createKyselyPaymentOutboxRepository } from "./payment-outbox.repository.kysely.js";

export function createKyselyPaymentUnitOfWork(db: Db): PaymentUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          payments: createKyselyPaymentRepository(trx),
          outbox: createKyselyPaymentOutboxRepository(trx),
        }),
      );
    },
  };
}
