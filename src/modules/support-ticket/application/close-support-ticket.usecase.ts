import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CloseSupportTicketError,
  closeSupportTicket,
  type SupportTicket,
} from "../domain/index.js";
import type { SupportTicketUnitOfWork } from "../ports/index.js";

export type CloseSupportTicketCommand = Readonly<{
  ticketId: string;
}>;

export type CloseSupportTicketUseCaseError =
  | CloseSupportTicketError
  | {
      type: "SupportTicketNotFound";
      ticketId: string;
      message: string;
    };

export type CloseSupportTicketUseCaseResult = Readonly<{
  ticket: SupportTicket;
  idempotent: boolean;
}>;

export type CloseSupportTicketUseCase = (
  command: CloseSupportTicketCommand,
) => Promise<Result<CloseSupportTicketUseCaseResult, CloseSupportTicketUseCaseError>>;

export function createCloseSupportTicketUseCase(deps: {
  uow: SupportTicketUnitOfWork;
  now: () => Date;
}): CloseSupportTicketUseCase {
  return async function closeSupportTicketUseCase(command) {
    return deps.uow.withTransaction<
      CloseSupportTicketUseCaseResult,
      CloseSupportTicketUseCaseError
    >(async ({ tickets, outbox }) => {
      const current = await tickets.findByIdForUpdate(command.ticketId);
      if (current === null) {
        return err({
          type: "SupportTicketNotFound",
          ticketId: command.ticketId,
          message: "Support ticket was not found",
        });
      }

      const closed = closeSupportTicket(current, deps.now());
      if (!closed.ok) {
        return err(closed.error);
      }

      await tickets.save(closed.value.ticket, closed.value.events);
      await outbox.saveAll(closed.value.events);

      return ok({
        ticket: closed.value.ticket,
        idempotent: closed.value.events.length === 0,
      });
    });
  };
}
