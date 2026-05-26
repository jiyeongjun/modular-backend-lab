import type { PaymentEvent } from "../domain/index.js";

export type PaymentOutboxRepository = {
  saveAll(events: readonly PaymentEvent[]): Promise<void>;
};
