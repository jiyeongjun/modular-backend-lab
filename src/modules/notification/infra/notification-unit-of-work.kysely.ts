import type { Db } from "../../../infra/db/db.js";
import type { NotificationUnitOfWork } from "../ports/index.js";
import { createKyselyNotificationRepository } from "./notification.repository.kysely.js";
import { createKyselyNotificationOutboxRepository } from "./notification-outbox.repository.kysely.js";

export function createKyselyNotificationUnitOfWork(db: Db): NotificationUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          notifications: createKyselyNotificationRepository(trx),
          outbox: createKyselyNotificationOutboxRepository(trx),
        }),
      );
    },
  };
}
