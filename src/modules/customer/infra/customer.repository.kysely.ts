import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { Customer, CustomerEvent } from "../domain/index.js";
import type { CustomerRepository } from "../ports/index.js";
import { toCustomer, toCustomerInsert, toCustomerUpdate } from "./customer.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyCustomerRepository(db: DbExecutor): CustomerRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("customers")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toCustomer(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("customers")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toCustomer(row) : null;
    },

    async findByEmail(email) {
      const row = await db
        .selectFrom("customers")
        .selectAll()
        .where("email", "=", email)
        .executeTakeFirst();
      return row ? toCustomer(row) : null;
    },

    async findByIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("customers")
        .selectAll()
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toCustomer(row) : null;
    },

    async create(customer, events) {
      await appendDomainEvents(db, events, -1);
      await db.insertInto("customers").values(toCustomerInsert(customer)).execute();
    },

    async save(customer: Customer, events: readonly CustomerEvent[]) {
      if (events.length === 0) {
        return;
      }

      const result = await db
        .updateTable("customers")
        .set({
          ...toCustomerUpdate(customer),
          version: customer.version + events.length,
        })
        .where("id", "=", customer.id)
        .where("version", "=", customer.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Customer ${customer.id} has a stale version`);
      }

      await appendDomainEvents(db, events, customer.version);
    },
  };
}
