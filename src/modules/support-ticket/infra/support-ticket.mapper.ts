import type {
  SupportTicketInsert,
  SupportTicketRow,
  SupportTicketUpdate,
} from "../../../infra/db/database.js";
import type {
  AssignedSupportTicket,
  ClosedSupportTicket,
  OpenSupportTicket,
  ResolvedSupportTicket,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  WaitingCustomerSupportTicket,
} from "../domain/index.js";

function toCategory(value: string): SupportTicketCategory {
  switch (value) {
    case "ORDER":
    case "PAYMENT":
    case "FULFILLMENT":
    case "RETURN":
    case "REFUND":
    case "ACCOUNT":
    case "OTHER":
      return value;
  }

  throw new Error(`Unknown support ticket category: ${value}`);
}

function toPriority(value: string): SupportTicketPriority {
  switch (value) {
    case "LOW":
    case "NORMAL":
    case "HIGH":
    case "URGENT":
      return value;
  }

  throw new Error(`Unknown support ticket priority: ${value}`);
}

function toStatus(value: string): SupportTicketStatus {
  switch (value) {
    case "OPEN":
    case "ASSIGNED":
    case "WAITING_CUSTOMER":
    case "RESOLVED":
    case "CLOSED":
      return value;
  }

  throw new Error(`Unknown support ticket status: ${value}`);
}

function base(row: SupportTicketRow) {
  return {
    id: row.id,
    customerId: row.customer_id,
    idempotencyKey: row.idempotency_key,
    category: toCategory(row.category),
    priority: toPriority(row.priority),
    subject: row.subject,
    description: row.description,
    orderId: row.order_id,
    returnId: row.return_id,
    refundId: row.refund_id,
    openedAt: row.opened_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSupportTicket(row: SupportTicketRow): SupportTicket {
  switch (toStatus(row.status)) {
    case "OPEN": {
      if (
        row.assignee_id !== null ||
        row.assigned_at !== null ||
        row.waiting_at !== null ||
        row.resolution !== null ||
        row.resolved_at !== null ||
        row.closed_at !== null
      ) {
        throw new Error(`Open support ticket ${row.id} has non-open columns`);
      }

      const ticket: OpenSupportTicket = {
        ...base(row),
        status: "OPEN",
        assigneeId: null,
        assignedAt: null,
        waitingAt: null,
        resolution: null,
        resolvedAt: null,
        closedAt: null,
      };
      return ticket;
    }

    case "ASSIGNED": {
      if (
        row.assignee_id === null ||
        row.assigned_at === null ||
        row.waiting_at !== null ||
        row.resolution !== null ||
        row.resolved_at !== null ||
        row.closed_at !== null
      ) {
        throw new Error(`Assigned support ticket ${row.id} has invalid columns`);
      }

      const ticket: AssignedSupportTicket = {
        ...base(row),
        status: "ASSIGNED",
        assigneeId: row.assignee_id,
        assignedAt: row.assigned_at,
        waitingAt: null,
        resolution: null,
        resolvedAt: null,
        closedAt: null,
      };
      return ticket;
    }

    case "WAITING_CUSTOMER": {
      if (row.waiting_at === null || row.resolution !== null || row.resolved_at !== null) {
        throw new Error(`Waiting support ticket ${row.id} has invalid columns`);
      }

      const ticket: WaitingCustomerSupportTicket = {
        ...base(row),
        status: "WAITING_CUSTOMER",
        assigneeId: row.assignee_id,
        assignedAt: row.assigned_at,
        waitingAt: row.waiting_at,
        resolution: null,
        resolvedAt: null,
        closedAt: null,
      };
      return ticket;
    }

    case "RESOLVED": {
      if (row.resolution === null || row.resolved_at === null || row.closed_at !== null) {
        throw new Error(`Resolved support ticket ${row.id} has invalid columns`);
      }

      const ticket: ResolvedSupportTicket = {
        ...base(row),
        status: "RESOLVED",
        assigneeId: row.assignee_id,
        assignedAt: row.assigned_at,
        waitingAt: row.waiting_at,
        resolution: row.resolution,
        resolvedAt: row.resolved_at,
        closedAt: null,
      };
      return ticket;
    }

    case "CLOSED": {
      if (row.resolution === null || row.resolved_at === null || row.closed_at === null) {
        throw new Error(`Closed support ticket ${row.id} has invalid columns`);
      }

      const ticket: ClosedSupportTicket = {
        ...base(row),
        status: "CLOSED",
        assigneeId: row.assignee_id,
        assignedAt: row.assigned_at,
        waitingAt: row.waiting_at,
        resolution: row.resolution,
        resolvedAt: row.resolved_at,
        closedAt: row.closed_at,
      };
      return ticket;
    }
  }
}

export function toSupportTicketInsert(ticket: SupportTicket): SupportTicketInsert {
  return {
    id: ticket.id,
    customer_id: ticket.customerId,
    idempotency_key: ticket.idempotencyKey,
    category: ticket.category,
    priority: ticket.priority,
    subject: ticket.subject,
    description: ticket.description,
    order_id: ticket.orderId,
    return_id: ticket.returnId,
    refund_id: ticket.refundId,
    status: ticket.status,
    assignee_id: ticket.assigneeId,
    resolution: ticket.resolution,
    opened_at: ticket.openedAt,
    assigned_at: ticket.assignedAt,
    waiting_at: ticket.waitingAt,
    resolved_at: ticket.resolvedAt,
    closed_at: ticket.closedAt,
    version: ticket.version,
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
  };
}

export function toSupportTicketUpdate(ticket: SupportTicket): SupportTicketUpdate {
  return {
    priority: ticket.priority,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    assignee_id: ticket.assigneeId,
    resolution: ticket.resolution,
    assigned_at: ticket.assignedAt,
    waiting_at: ticket.waitingAt,
    resolved_at: ticket.resolvedAt,
    closed_at: ticket.closedAt,
    updated_at: ticket.updatedAt,
  };
}
