import type { SettlementEvent } from "../domain/index.js";

export type SettlementOutboxRepository = {
  saveAll(events: readonly SettlementEvent[]): Promise<void>;
};
