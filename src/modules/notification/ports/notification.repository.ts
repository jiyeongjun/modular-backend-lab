import type { Notification, NotificationEvent } from "../domain/index.js";

export type NotificationRepository = {
  findById(id: string): Promise<Notification | null>;
  findByIdForUpdate(id: string): Promise<Notification | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Notification | null>;
  create(notification: Notification, events: readonly NotificationEvent[]): Promise<void>;
  save(notification: Notification, events: readonly NotificationEvent[]): Promise<void>;
};
