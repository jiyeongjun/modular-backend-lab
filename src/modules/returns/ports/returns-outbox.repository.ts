import type { ReturnRequestEvent } from "../domain/index.js";

export type ReturnsOutboxRepository = {
  saveAll(events: readonly ReturnRequestEvent[]): Promise<void>;
};
