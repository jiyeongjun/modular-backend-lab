import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { ActiveInventoryReservation, InventoryReservation } from "../domain/index.js";
import type { InventoryReservationReader, InventoryReservationRepository } from "../ports/index.js";
import {
  toInventoryReservation,
  toInventoryReservationInsert,
  toInventoryReservationUpdate,
} from "./inventory.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyInventoryReservationRepository(
  db: DbExecutor,
): InventoryReservationRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("inventory_reservations")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      return row ? toInventoryReservation(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("inventory_reservations")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();

      return row ? toInventoryReservation(row) : null;
    },

    async findByIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("inventory_reservations")
        .selectAll()
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();

      return row ? toInventoryReservation(row) : null;
    },

    async create(reservation: ActiveInventoryReservation) {
      await db
        .insertInto("inventory_reservations")
        .values(toInventoryReservationInsert(reservation))
        .execute();
    },

    async save(reservation: InventoryReservation) {
      const result = await db
        .updateTable("inventory_reservations")
        .set({
          ...toInventoryReservationUpdate(reservation),
          version: reservation.version + 1,
        })
        .where("id", "=", reservation.id)
        .where("version", "=", reservation.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Inventory reservation ${reservation.id} is stale`);
      }
    },
  };
}

export function createKyselyInventoryReservationReader(db: DbExecutor): InventoryReservationReader {
  return {
    async *iterateExpiredActive(options) {
      if (options.batchSize < 1) {
        throw new Error("batchSize must be greater than zero");
      }

      const rows = await db
        .selectFrom("inventory_reservations")
        .selectAll()
        .where("status", "=", "ACTIVE")
        .where("expires_at", "<=", options.now)
        .orderBy("expires_at", "asc")
        .orderBy("id", "asc")
        .limit(options.batchSize)
        .execute();

      for (const row of rows) {
        const reservation = toInventoryReservation(row);
        if (reservation.status === "ACTIVE") {
          yield reservation;
        }
      }
    },
  };
}
