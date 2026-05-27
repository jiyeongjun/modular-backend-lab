import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type ResolveSupportTicketError,
  resolveSupportTicket,
  type SupportTicket,
} from "../domain/index.js";
import type { SupportTicketUnitOfWork } from "../ports/index.js";

export type ResolveSupportTicketCommand = Readonly<{
  ticketId: string;
  resolution: string;
}>;

export type ResolveSupportTicketUseCaseError =
  | ResolveSupportTicketError
  | {
      type: "SupportTicketNotFound";
      ticketId: string;
      message: string;
    };

export type ResolveSupportTicketUseCaseResult = Readonly<{
  ticket: SupportTicket;
  idempotent: boolean;
}>;

export type ResolveSupportTicketUseCase = (
  command: ResolveSupportTicketCommand,
) => Promise<Result<ResolveSupportTicketUseCaseResult, ResolveSupportTicketUseCaseError>>;

export function createResolveSupportTicketUseCase(deps: {
  uow: SupportTicketUnitOfWork;
  now: () => Date;
}): ResolveSupportTicketUseCase {
  return async function resolveSupportTicketUseCase(command) {
    return deps.uow.withTransaction<
      ResolveSupportTicketUseCaseResult,
      ResolveSupportTicketUseCaseError
    >(async ({ tickets, outbox }) => {
      const current = await tickets.findByIdForUpdate(command.ticketId);
      if (current === null) {
        return err({
          type: "SupportTicketNotFound",
          ticketId: command.ticketId,
          message: "Support ticket was not found",
        });
      }

      const resolved = resolveSupportTicket(current, {
        resolution: command.resolution,
        now: deps.now(),
      });
      if (!resolved.ok) {
        return err(resolved.error);
      }

      await tickets.save(resolved.value.ticket, resolved.value.events);
      await outbox.saveAll(resolved.value.events);

      return ok({
        ticket: resolved.value.ticket,
        idempotent: resolved.value.events.length === 0,
      });
    });
  };
}
