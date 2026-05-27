import type { SupportTicketCategory, SupportTicketPriority } from "./support-ticket.js";

export type SupportTicketOpenedEvent = Readonly<{
  type: "SupportTicketOpened";
  aggregateType: "SupportTicket";
  aggregateId: string;
  occurredAt: Date;
  payload: Readonly<{
    ticketId: string;
    customerId: string;
    idempotencyKey: string;
    category: SupportTicketCategory;
    priority: SupportTicketPriority;
    subject: string;
    description: string;
    orderId: string | null;
    returnId: string | null;
    refundId: string | null;
    openedAt: Date;
  }>;
}>;

export type SupportTicketAssignedEvent = Readonly<{
  type: "SupportTicketAssigned";
  aggregateType: "SupportTicket";
  aggregateId: string;
  occurredAt: Date;
  payload: Readonly<{
    ticketId: string;
    customerId: string;
    assigneeId: string;
    assignedAt: Date;
  }>;
}>;

export type SupportTicketWaitingForCustomerEvent = Readonly<{
  type: "SupportTicketWaitingForCustomer";
  aggregateType: "SupportTicket";
  aggregateId: string;
  occurredAt: Date;
  payload: Readonly<{
    ticketId: string;
    customerId: string;
    assigneeId: string | null;
    waitingAt: Date;
  }>;
}>;

export type SupportTicketResolvedEvent = Readonly<{
  type: "SupportTicketResolved";
  aggregateType: "SupportTicket";
  aggregateId: string;
  occurredAt: Date;
  payload: Readonly<{
    ticketId: string;
    customerId: string;
    resolution: string;
    resolvedAt: Date;
  }>;
}>;

export type SupportTicketClosedEvent = Readonly<{
  type: "SupportTicketClosed";
  aggregateType: "SupportTicket";
  aggregateId: string;
  occurredAt: Date;
  payload: Readonly<{
    ticketId: string;
    customerId: string;
    closedAt: Date;
  }>;
}>;

export type SupportTicketEvent =
  | SupportTicketOpenedEvent
  | SupportTicketAssignedEvent
  | SupportTicketWaitingForCustomerEvent
  | SupportTicketResolvedEvent
  | SupportTicketClosedEvent;
