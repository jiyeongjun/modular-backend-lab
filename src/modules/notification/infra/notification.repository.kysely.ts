import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { Notification, NotificationEvent } from "../domain/index.js";
import type { NotificationRepository } from "../ports/index.js";
import {
  toNotification,
  toNotificationInsert,
  toNotificationUpdate,
} from "./notification.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyNotificationRepository(db: DbExecutor): NotificationRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("notification_requests")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toNotification(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("notification_requests")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toNotification(row) : null;
    },

    async findByIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("notification_requests")
        .selectAll()
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toNotification(row) : null;
    },

    async create(notification, events) {
      await appendDomainEvents(db, events, -1);
      await db
        .insertInto("notification_requests")
        .values(toNotificationInsert(notification))
        .execute();
    },

    async save(notification: Notification, events: readonly NotificationEvent[]) {
      if (events.length === 0) {
        return;
      }

      const result = await db
        .updateTable("notification_requests")
        .set({
          ...toNotificationUpdate(notification),
          version: notification.version + events.length,
        })
        .where("id", "=", notification.id)
        .where("version", "=", notification.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Notification ${notification.id} has a stale version`);
      }

      await appendDomainEvents(db, events, notification.version);
    },
  };
}
