import type { Db } from "../../../infra/db/db.js";
import type { AuthUnitOfWork } from "../ports/index.js";
import { createKyselyAuthCredentialRepository } from "./auth-credential.repository.kysely.js";
import { createKyselyAuthOutboxRepository } from "./auth-outbox.repository.kysely.js";
import { createKyselyAuthSessionRepository } from "./auth-session.repository.kysely.js";

export function createKyselyAuthUnitOfWork(db: Db): AuthUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          credentials: createKyselyAuthCredentialRepository(trx),
          sessions: createKyselyAuthSessionRepository(trx),
          outbox: createKyselyAuthOutboxRepository(trx),
        }),
      );
    },
  };
}
