import type { Db } from "../../../infra/db/db.js";
import type { InventoryUnitOfWork } from "../ports/index.js";
import { createKyselyInventoryItemRepository } from "./inventory.repository.kysely.js";
import { createKyselyInventoryOutboxRepository } from "./inventory-outbox.repository.kysely.js";
import { createKyselyInventoryReservationRepository } from "./inventory-reservation.repository.kysely.js";

export function createKyselyInventoryUnitOfWork(db: Db): InventoryUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          items: createKyselyInventoryItemRepository(trx),
          reservations: createKyselyInventoryReservationRepository(trx),
          outbox: createKyselyInventoryOutboxRepository(trx),
        }),
      );
    },
  };
}
