import type { NotificationEvent } from "../domain/index.js";

export type NotificationOutboxRepository = {
  saveAll(events: readonly NotificationEvent[]): Promise<void>;
};
