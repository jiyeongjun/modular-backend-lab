import type { Result } from "../../../shared/result/index.js";
import type { SupportTicketRepository } from "./support-ticket.repository.js";
import type { SupportTicketOutboxRepository } from "./support-ticket-outbox.repository.js";

export type SupportTicketUnitOfWorkContext = Readonly<{
  tickets: SupportTicketRepository;
  outbox: SupportTicketOutboxRepository;
}>;

export type SupportTicketUnitOfWork = {
  withTransaction<TValue, TError>(
    work: (context: SupportTicketUnitOfWorkContext) => Promise<Result<TValue, TError>>,
  ): Promise<Result<TValue, TError>>;
};
