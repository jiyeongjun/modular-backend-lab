import type { Db } from "../../../infra/db/db.js";
import type { AddressBookUnitOfWork } from "../ports/index.js";
import { createKyselyAddressRepository } from "./address.repository.kysely.js";
import { createKyselyAddressOutboxRepository } from "./address-outbox.repository.kysely.js";

export function createKyselyAddressBookUnitOfWork(db: Db): AddressBookUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          addresses: createKyselyAddressRepository(trx),
          outbox: createKyselyAddressOutboxRepository(trx),
        }),
      );
    },
  };
}
