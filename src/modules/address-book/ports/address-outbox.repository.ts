import type { AddressEvent } from "../domain/index.js";

export type AddressOutboxRepository = {
  saveAll(events: readonly AddressEvent[]): Promise<void>;
};
