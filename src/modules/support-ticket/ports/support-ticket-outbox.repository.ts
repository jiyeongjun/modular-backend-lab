import type { SupportTicketEvent } from "../domain/index.js";

export type SupportTicketOutboxRepository = {
  saveAll(events: readonly SupportTicketEvent[]): Promise<void>;
};
