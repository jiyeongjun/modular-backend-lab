import type { SupportTicket, SupportTicketEvent } from "../domain/index.js";

export type SupportTicketRepository = {
  findById(id: string): Promise<SupportTicket | null>;
  findByIdForUpdate(id: string): Promise<SupportTicket | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<SupportTicket | null>;
  create(ticket: SupportTicket, events: readonly SupportTicketEvent[]): Promise<void>;
  save(ticket: SupportTicket, events: readonly SupportTicketEvent[]): Promise<void>;
};
