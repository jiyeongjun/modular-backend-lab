import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type MarkSupportTicketWaitingError,
  markSupportTicketWaitingForCustomer,
  type SupportTicket,
} from "../domain/index.js";
import type { SupportTicketUnitOfWork } from "../ports/index.js";

export type MarkSupportTicketWaitingCommand = Readonly<{
  ticketId: string;
}>;

export type MarkSupportTicketWaitingUseCaseError =
  | MarkSupportTicketWaitingError
  | {
      type: "SupportTicketNotFound";
      ticketId: string;
      message: string;
    };

export type MarkSupportTicketWaitingUseCaseResult = Readonly<{
  ticket: SupportTicket;
  idempotent: boolean;
}>;

export type MarkSupportTicketWaitingUseCase = (
  command: MarkSupportTicketWaitingCommand,
) => Promise<Result<MarkSupportTicketWaitingUseCaseResult, MarkSupportTicketWaitingUseCaseError>>;

export function createMarkSupportTicketWaitingUseCase(deps: {
  uow: SupportTicketUnitOfWork;
  now: () => Date;
}): MarkSupportTicketWaitingUseCase {
  return async function markSupportTicketWaitingUseCase(command) {
    return deps.uow.withTransaction<
      MarkSupportTicketWaitingUseCaseResult,
      MarkSupportTicketWaitingUseCaseError
    >(async ({ tickets, outbox }) => {
      const current = await tickets.findByIdForUpdate(command.ticketId);
      if (current === null) {
        return err({
          type: "SupportTicketNotFound",
          ticketId: command.ticketId,
          message: "Support ticket was not found",
        });
      }

      const waiting = markSupportTicketWaitingForCustomer(current, deps.now());
      if (!waiting.ok) {
        return err(waiting.error);
      }

      await tickets.save(waiting.value.ticket, waiting.value.events);
      await outbox.saveAll(waiting.value.events);

      return ok({
        ticket: waiting.value.ticket,
        idempotent: waiting.value.events.length === 0,
      });
    });
  };
}
