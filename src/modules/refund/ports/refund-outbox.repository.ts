import type { RefundEvent } from "../domain/index.js";

export type RefundOutboxRepository = {
  saveAll(events: readonly RefundEvent[]): Promise<void>;
};
