import type { CustomerEvent } from "../domain/index.js";

export type CustomerOutboxRepository = {
  saveAll(events: readonly CustomerEvent[]): Promise<void>;
};
