import type { Db } from "../../../infra/db/db.js";
import type { AuthorizationUnitOfWork } from "../ports/index.js";
import { createKyselyAuthorizationRepository } from "./authorization.repository.kysely.js";
import { createKyselyAuthorizationOutboxRepository } from "./authorization-outbox.repository.kysely.js";

export function createKyselyAuthorizationUnitOfWork(db: Db): AuthorizationUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          grants: createKyselyAuthorizationRepository(trx),
          outbox: createKyselyAuthorizationOutboxRepository(trx),
        }),
      );
    },
  };
}
