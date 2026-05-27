import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  AssignSupportTicketError,
  CloseSupportTicketError,
  CreateSupportTicketError,
  InvalidSupportTicketInput,
  MarkSupportTicketWaitingError,
  ResolveSupportTicketError,
} from "./support-ticket.errors.js";
import type { SupportTicketEvent } from "./support-ticket.events.js";
import type {
  AssignedSupportTicket,
  ClosedSupportTicket,
  OpenSupportTicket,
  ResolvedSupportTicket,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketReferences,
  WaitingCustomerSupportTicket,
} from "./support-ticket.js";

export type CreateSupportTicketInput = SupportTicketReferences &
  Readonly<{
    id: string;
    customerId: string;
    idempotencyKey: string;
    category: SupportTicketCategory;
    priority: SupportTicketPriority;
    subject: string;
    description: string;
    now: Date;
  }>;

export type SupportTicketTransition<T extends SupportTicket> = Readonly<{
  ticket: T;
  events: readonly SupportTicketEvent[];
}>;

export function createSupportTicket(
  input: CreateSupportTicketInput,
): Result<OpenSupportTicket, CreateSupportTicketError> {
  const subject = input.subject.trim();
  const description = input.description.trim();
  const invalidInput = validateRequiredFields([
    ["id", input.id],
    ["customerId", input.customerId],
    ["idempotencyKey", input.idempotencyKey],
    ["subject", subject],
    ["description", description],
  ]);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  return ok({
    id: input.id.trim(),
    customerId: input.customerId.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
    category: input.category,
    priority: input.priority,
    subject,
    description,
    orderId: normalizeNullable(input.orderId),
    returnId: normalizeNullable(input.returnId),
    refundId: normalizeNullable(input.refundId),
    status: "OPEN",
    assigneeId: null,
    assignedAt: null,
    waitingAt: null,
    resolution: null,
    resolvedAt: null,
    closedAt: null,
    openedAt: input.now,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function supportTicketOpenedEvent(ticket: OpenSupportTicket): SupportTicketEvent {
  return {
    type: "SupportTicketOpened",
    aggregateType: "SupportTicket",
    aggregateId: ticket.id,
    occurredAt: ticket.openedAt,
    payload: {
      ticketId: ticket.id,
      customerId: ticket.customerId,
      idempotencyKey: ticket.idempotencyKey,
      category: ticket.category,
      priority: ticket.priority,
      subject: ticket.subject,
      description: ticket.description,
      orderId: ticket.orderId,
      returnId: ticket.returnId,
      refundId: ticket.refundId,
      openedAt: ticket.openedAt,
    },
  };
}

export function assignSupportTicket(
  ticket: SupportTicket,
  input: Readonly<{ assigneeId: string; now: Date }>,
): Result<SupportTicketTransition<AssignedSupportTicket>, AssignSupportTicketError> {
  const assigneeId = input.assigneeId.trim();
  const invalidInput = validateRequiredFields([["assigneeId", assigneeId]]);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  switch (ticket.status) {
    case "OPEN":
    case "WAITING_CUSTOMER":
    case "ASSIGNED": {
      if (ticket.status === "ASSIGNED" && ticket.assigneeId === assigneeId) {
        return ok({ ticket, events: [] });
      }

      const assigned: AssignedSupportTicket = {
        ...ticket,
        status: "ASSIGNED",
        assigneeId,
        assignedAt: input.now,
        waitingAt: null,
        resolution: null,
        resolvedAt: null,
        closedAt: null,
        updatedAt: input.now,
      };

      return ok({
        ticket: assigned,
        events: [
          {
            type: "SupportTicketAssigned",
            aggregateType: "SupportTicket",
            aggregateId: assigned.id,
            occurredAt: input.now,
            payload: {
              ticketId: assigned.id,
              customerId: assigned.customerId,
              assigneeId: assigned.assigneeId,
              assignedAt: assigned.assignedAt,
            },
          },
        ],
      });
    }

    case "RESOLVED":
    case "CLOSED":
      return err({
        type: "SupportTicketNotAssignable",
        status: ticket.status,
        message: "Support ticket cannot be assigned from its current status",
      });
  }
}

export function markSupportTicketWaitingForCustomer(
  ticket: SupportTicket,
  now: Date,
): Result<SupportTicketTransition<WaitingCustomerSupportTicket>, MarkSupportTicketWaitingError> {
  switch (ticket.status) {
    case "OPEN":
    case "ASSIGNED": {
      const waiting: WaitingCustomerSupportTicket = {
        ...ticket,
        status: "WAITING_CUSTOMER",
        waitingAt: now,
        resolution: null,
        resolvedAt: null,
        closedAt: null,
        updatedAt: now,
      };

      return ok({
        ticket: waiting,
        events: [
          {
            type: "SupportTicketWaitingForCustomer",
            aggregateType: "SupportTicket",
            aggregateId: waiting.id,
            occurredAt: now,
            payload: {
              ticketId: waiting.id,
              customerId: waiting.customerId,
              assigneeId: waiting.assigneeId,
              waitingAt: waiting.waitingAt,
            },
          },
        ],
      });
    }

    case "WAITING_CUSTOMER":
      return ok({ ticket, events: [] });

    case "RESOLVED":
    case "CLOSED":
      return err({
        type: "SupportTicketNotWaitable",
        status: ticket.status,
        message: "Support ticket cannot wait for customer from its current status",
      });
  }
}

export function resolveSupportTicket(
  ticket: SupportTicket,
  input: Readonly<{ resolution: string; now: Date }>,
): Result<SupportTicketTransition<ResolvedSupportTicket>, ResolveSupportTicketError> {
  const resolution = input.resolution.trim();
  const invalidInput = validateRequiredFields([["resolution", resolution]]);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  switch (ticket.status) {
    case "OPEN":
    case "ASSIGNED":
    case "WAITING_CUSTOMER": {
      const resolved: ResolvedSupportTicket = {
        ...ticket,
        status: "RESOLVED",
        resolution,
        resolvedAt: input.now,
        closedAt: null,
        updatedAt: input.now,
      };

      return ok({
        ticket: resolved,
        events: [
          {
            type: "SupportTicketResolved",
            aggregateType: "SupportTicket",
            aggregateId: resolved.id,
            occurredAt: input.now,
            payload: {
              ticketId: resolved.id,
              customerId: resolved.customerId,
              resolution: resolved.resolution,
              resolvedAt: resolved.resolvedAt,
            },
          },
        ],
      });
    }

    case "RESOLVED":
      return ok({ ticket, events: [] });

    case "CLOSED":
      return err({
        type: "SupportTicketNotResolvable",
        status: ticket.status,
        message: "Support ticket cannot be resolved from its current status",
      });
  }
}

export function closeSupportTicket(
  ticket: SupportTicket,
  now: Date,
): Result<SupportTicketTransition<ClosedSupportTicket>, CloseSupportTicketError> {
  switch (ticket.status) {
    case "RESOLVED": {
      const closed: ClosedSupportTicket = {
        ...ticket,
        status: "CLOSED",
        closedAt: now,
        updatedAt: now,
      };

      return ok({
        ticket: closed,
        events: [
          {
            type: "SupportTicketClosed",
            aggregateType: "SupportTicket",
            aggregateId: closed.id,
            occurredAt: now,
            payload: {
              ticketId: closed.id,
              customerId: closed.customerId,
              closedAt: closed.closedAt,
            },
          },
        ],
      });
    }

    case "CLOSED":
      return ok({ ticket, events: [] });

    case "OPEN":
    case "ASSIGNED":
    case "WAITING_CUSTOMER":
      return err({
        type: "SupportTicketNotClosable",
        status: ticket.status,
        message: "Support ticket must be resolved before closure",
      });
  }
}

function normalizeNullable(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function validateRequiredFields(
  entries: readonly (readonly [InvalidSupportTicketInput["field"], string])[],
): InvalidSupportTicketInput | null {
  for (const [field, value] of entries) {
    if (value.trim().length === 0) {
      return {
        type: "InvalidSupportTicketInput",
        field,
        message: `Support ticket ${field} is required`,
      };
    }
  }

  return null;
}
