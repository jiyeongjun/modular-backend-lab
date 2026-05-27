import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CreateSupportTicketError,
  createSupportTicket,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketPriority,
  type SupportTicketReferences,
  supportTicketOpenedEvent,
} from "../domain/index.js";
import type { SupportTicketUnitOfWork } from "../ports/index.js";

export type CreateSupportTicketCommand = SupportTicketReferences &
  Readonly<{
    customerId: string;
    idempotencyKey: string;
    category: SupportTicketCategory;
    priority: SupportTicketPriority;
    subject: string;
    description: string;
  }>;

export type CreateSupportTicketUseCaseError =
  | CreateSupportTicketError
  | {
      type: "SupportTicketIdempotencyConflict";
      idempotencyKey: string;
      message: string;
    };

export type CreateSupportTicketUseCaseResult = Readonly<{
  ticket: SupportTicket;
  idempotent: boolean;
}>;

export type CreateSupportTicketUseCase = (
  command: CreateSupportTicketCommand,
) => Promise<Result<CreateSupportTicketUseCaseResult, CreateSupportTicketUseCaseError>>;

export function createCreateSupportTicketUseCase(deps: {
  uow: SupportTicketUnitOfWork;
  now: () => Date;
  generateId: () => string;
}): CreateSupportTicketUseCase {
  return async function createSupportTicketUseCase(command) {
    return deps.uow.withTransaction<
      CreateSupportTicketUseCaseResult,
      CreateSupportTicketUseCaseError
    >(async ({ tickets, outbox }) => {
      const existing = await tickets.findByIdempotencyKey(command.idempotencyKey);
      if (existing !== null) {
        if (!sameCreateCommand(existing, command)) {
          return err({
            type: "SupportTicketIdempotencyConflict",
            idempotencyKey: command.idempotencyKey,
            message: "Support ticket idempotency key belongs to another command",
          });
        }

        return ok({ ticket: existing, idempotent: true });
      }

      const created = createSupportTicket({
        id: deps.generateId(),
        customerId: command.customerId,
        idempotencyKey: command.idempotencyKey,
        category: command.category,
        priority: command.priority,
        subject: command.subject,
        description: command.description,
        orderId: command.orderId,
        returnId: command.returnId,
        refundId: command.refundId,
        now: deps.now(),
      });
      if (!created.ok) {
        return err(created.error);
      }

      const events = [supportTicketOpenedEvent(created.value)];
      await tickets.create(created.value, events);
      await outbox.saveAll(events);

      return ok({ ticket: created.value, idempotent: false });
    });
  };
}

function sameCreateCommand(ticket: SupportTicket, command: CreateSupportTicketCommand): boolean {
  return (
    ticket.customerId === command.customerId &&
    ticket.category === command.category &&
    ticket.priority === command.priority &&
    ticket.subject === command.subject.trim() &&
    ticket.description === command.description.trim() &&
    ticket.orderId === normalizeNullable(command.orderId) &&
    ticket.returnId === normalizeNullable(command.returnId) &&
    ticket.refundId === normalizeNullable(command.refundId)
  );
}

function normalizeNullable(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}
