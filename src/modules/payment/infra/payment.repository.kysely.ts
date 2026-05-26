import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { PaymentRepository } from "../ports/index.js";
import { toPayment, toPaymentInsert, toPaymentUpdate } from "./payment.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyPaymentRepository(db: DbExecutor): PaymentRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("payments")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toPayment(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("payments")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toPayment(row) : null;
    },

    async findByOrderId(orderId) {
      const row = await db
        .selectFrom("payments")
        .selectAll()
        .where("order_id", "=", orderId)
        .executeTakeFirst();
      return row ? toPayment(row) : null;
    },

    async findByConfirmIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("payments")
        .selectAll()
        .where("confirm_idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toPayment(row) : null;
    },

    async findByCancelIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("payments")
        .selectAll()
        .where("cancel_idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toPayment(row) : null;
    },

    async create(payment) {
      await db.insertInto("payments").values(toPaymentInsert(payment)).execute();
    },

    async save(payment) {
      const result = await db
        .updateTable("payments")
        .set({
          ...toPaymentUpdate(payment),
          version: payment.version + 1,
        })
        .where("id", "=", payment.id)
        .where("version", "=", payment.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Payment ${payment.id} has a stale version`);
      }
    },
  };
}
