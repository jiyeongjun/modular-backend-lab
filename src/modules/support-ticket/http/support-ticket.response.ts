import type { Result } from "../../../shared/result/index.js";
import type {
  AssignSupportTicketUseCaseError,
  AssignSupportTicketUseCaseResult,
  CloseSupportTicketUseCaseError,
  CloseSupportTicketUseCaseResult,
  CreateSupportTicketUseCaseError,
  CreateSupportTicketUseCaseResult,
  MarkSupportTicketWaitingUseCaseError,
  MarkSupportTicketWaitingUseCaseResult,
  ResolveSupportTicketUseCaseError,
  ResolveSupportTicketUseCaseResult,
} from "../application/index.js";
import type { SupportTicket } from "../domain/index.js";

export type SupportTicketHttpResponseShape = Readonly<{
  status: 200 | 201 | 400 | 404 | 409;
  body: unknown;
}>;

export function serializeSupportTicket(ticket: SupportTicket): Record<string, unknown> {
  return {
    id: ticket.id,
    customerId: ticket.customerId,
    idempotencyKey: ticket.idempotencyKey,
    category: ticket.category,
    priority: ticket.priority,
    subject: ticket.subject,
    description: ticket.description,
    orderId: ticket.orderId,
    returnId: ticket.returnId,
    refundId: ticket.refundId,
    status: ticket.status,
    assigneeId: ticket.assigneeId,
    resolution: ticket.resolution,
    openedAt: ticket.openedAt.toISOString(),
    assignedAt: ticket.assignedAt?.toISOString() ?? null,
    waitingAt: ticket.waitingAt?.toISOString() ?? null,
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    version: ticket.version,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export function mapCreateSupportTicketResult(
  result: Result<CreateSupportTicketUseCaseResult, CreateSupportTicketUseCaseError>,
): SupportTicketHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializeSupportTicket(result.value.ticket),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapSupportTicketError(result.error);
}

export function mapAssignSupportTicketResult(
  result: Result<AssignSupportTicketUseCaseResult, AssignSupportTicketUseCaseError>,
): SupportTicketHttpResponseShape {
  return mapMutationResult(result);
}

export function mapMarkSupportTicketWaitingResult(
  result: Result<MarkSupportTicketWaitingUseCaseResult, MarkSupportTicketWaitingUseCaseError>,
): SupportTicketHttpResponseShape {
  return mapMutationResult(result);
}

export function mapResolveSupportTicketResult(
  result: Result<ResolveSupportTicketUseCaseResult, ResolveSupportTicketUseCaseError>,
): SupportTicketHttpResponseShape {
  return mapMutationResult(result);
}

export function mapCloseSupportTicketResult(
  result: Result<CloseSupportTicketUseCaseResult, CloseSupportTicketUseCaseError>,
): SupportTicketHttpResponseShape {
  return mapMutationResult(result);
}

function mapMutationResult(
  result: Result<
    | AssignSupportTicketUseCaseResult
    | MarkSupportTicketWaitingUseCaseResult
    | ResolveSupportTicketUseCaseResult
    | CloseSupportTicketUseCaseResult,
    | AssignSupportTicketUseCaseError
    | MarkSupportTicketWaitingUseCaseError
    | ResolveSupportTicketUseCaseError
    | CloseSupportTicketUseCaseError
  >,
): SupportTicketHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeSupportTicket(result.value.ticket),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapSupportTicketError(result.error);
}

function mapSupportTicketError(
  error:
    | CreateSupportTicketUseCaseError
    | AssignSupportTicketUseCaseError
    | MarkSupportTicketWaitingUseCaseError
    | ResolveSupportTicketUseCaseError
    | CloseSupportTicketUseCaseError,
): SupportTicketHttpResponseShape {
  switch (error.type) {
    case "InvalidSupportTicketInput":
      return { status: 400, body: { error } };

    case "SupportTicketNotFound":
      return { status: 404, body: { error } };

    case "SupportTicketIdempotencyConflict":
    case "SupportTicketNotAssignable":
    case "SupportTicketNotWaitable":
    case "SupportTicketNotResolvable":
    case "SupportTicketNotClosable":
      return { status: 409, body: { error } };
  }
}
