import type { FulfillmentEvent } from "../domain/index.js";

export type FulfillmentOutboxRepository = {
  saveAll(events: readonly FulfillmentEvent[]): Promise<void>;
};
