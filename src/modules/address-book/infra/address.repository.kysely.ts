import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { Address, AddressEvent } from "../domain/index.js";
import type { AddressRepository } from "../ports/index.js";
import { toAddress, toAddressInsert, toAddressUpdate } from "./address.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyAddressRepository(db: DbExecutor): AddressRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("address_book_addresses")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toAddress(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("address_book_addresses")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toAddress(row) : null;
    },

    async findByIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("address_book_addresses")
        .selectAll()
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toAddress(row) : null;
    },

    async findDefault(customerId, purpose) {
      const row = await db
        .selectFrom("address_book_addresses")
        .selectAll()
        .where("customer_id", "=", customerId)
        .where("purpose", "=", purpose)
        .where("status", "=", "ACTIVE")
        .where("is_default", "=", true)
        .executeTakeFirst();
      return row ? toAddress(row) : null;
    },

    async clearDefaultForCustomerPurpose(customerId, purpose, exceptAddressId, now) {
      await db
        .updateTable("address_book_addresses")
        .set({ is_default: false, updated_at: now })
        .where("customer_id", "=", customerId)
        .where("purpose", "=", purpose)
        .where("id", "!=", exceptAddressId)
        .where("is_default", "=", true)
        .execute();
    },

    async create(address, events) {
      await appendDomainEvents(db, events, -1);
      await db.insertInto("address_book_addresses").values(toAddressInsert(address)).execute();
    },

    async save(address: Address, events: readonly AddressEvent[]) {
      if (events.length === 0) {
        return;
      }

      const result = await db
        .updateTable("address_book_addresses")
        .set({
          ...toAddressUpdate(address),
          version: address.version + events.length,
        })
        .where("id", "=", address.id)
        .where("version", "=", address.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Address ${address.id} has a stale version`);
      }

      await appendDomainEvents(db, events, address.version);
    },
  };
}
