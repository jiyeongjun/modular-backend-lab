import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type AssignSupportTicketError,
  assignSupportTicket,
  type SupportTicket,
} from "../domain/index.js";
import type { SupportTicketUnitOfWork } from "../ports/index.js";

export type AssignSupportTicketCommand = Readonly<{
  ticketId: string;
  assigneeId: string;
}>;

export type AssignSupportTicketUseCaseError =
  | AssignSupportTicketError
  | {
      type: "SupportTicketNotFound";
      ticketId: string;
      message: string;
    };

export type AssignSupportTicketUseCaseResult = Readonly<{
  ticket: SupportTicket;
  idempotent: boolean;
}>;

export type AssignSupportTicketUseCase = (
  command: AssignSupportTicketCommand,
) => Promise<Result<AssignSupportTicketUseCaseResult, AssignSupportTicketUseCaseError>>;

export function createAssignSupportTicketUseCase(deps: {
  uow: SupportTicketUnitOfWork;
  now: () => Date;
}): AssignSupportTicketUseCase {
  return async function assignSupportTicketUseCase(command) {
    return deps.uow.withTransaction<
      AssignSupportTicketUseCaseResult,
      AssignSupportTicketUseCaseError
    >(async ({ tickets, outbox }) => {
      const current = await tickets.findByIdForUpdate(command.ticketId);
      if (current === null) {
        return err({
          type: "SupportTicketNotFound",
          ticketId: command.ticketId,
          message: "Support ticket was not found",
        });
      }

      const assigned = assignSupportTicket(current, {
        assigneeId: command.assigneeId,
        now: deps.now(),
      });
      if (!assigned.ok) {
        return err(assigned.error);
      }

      await tickets.save(assigned.value.ticket, assigned.value.events);
      await outbox.saveAll(assigned.value.events);

      return ok({
        ticket: assigned.value.ticket,
        idempotent: assigned.value.events.length === 0,
      });
    });
  };
}
