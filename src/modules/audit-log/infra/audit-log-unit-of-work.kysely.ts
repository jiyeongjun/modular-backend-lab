import type { Db } from "../../../infra/db/db.js";
import type { AuditLogUnitOfWork } from "../ports/index.js";
import { createKyselyAuditLogOutboxRepository } from "./audit-log-outbox.repository.kysely.js";
import { createKyselyAuditRecordRepository } from "./audit-record.repository.kysely.js";

export function createKyselyAuditLogUnitOfWork(db: Db): AuditLogUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          auditRecords: createKyselyAuditRecordRepository(trx),
          outbox: createKyselyAuditLogOutboxRepository(trx),
        }),
      );
    },
  };
}
