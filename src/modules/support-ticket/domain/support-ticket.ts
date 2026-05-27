export type SupportTicketCategory =
  | "ORDER"
  | "PAYMENT"
  | "FULFILLMENT"
  | "RETURN"
  | "REFUND"
  | "ACCOUNT"
  | "OTHER";

export type SupportTicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type SupportTicketStatus = "OPEN" | "ASSIGNED" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED";

export type SupportTicketReferences = Readonly<{
  orderId: string | null;
  returnId: string | null;
  refundId: string | null;
}>;

type SupportTicketBase = SupportTicketReferences &
  Readonly<{
    id: string;
    customerId: string;
    idempotencyKey: string;
    category: SupportTicketCategory;
    priority: SupportTicketPriority;
    subject: string;
    description: string;
    openedAt: Date;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }>;

export type OpenSupportTicket = SupportTicketBase &
  Readonly<{
    status: "OPEN";
    assigneeId: null;
    assignedAt: null;
    waitingAt: null;
    resolution: null;
    resolvedAt: null;
    closedAt: null;
  }>;

export type AssignedSupportTicket = SupportTicketBase &
  Readonly<{
    status: "ASSIGNED";
    assigneeId: string;
    assignedAt: Date;
    waitingAt: null;
    resolution: null;
    resolvedAt: null;
    closedAt: null;
  }>;

export type WaitingCustomerSupportTicket = SupportTicketBase &
  Readonly<{
    status: "WAITING_CUSTOMER";
    assigneeId: string | null;
    assignedAt: Date | null;
    waitingAt: Date;
    resolution: null;
    resolvedAt: null;
    closedAt: null;
  }>;

export type ResolvedSupportTicket = SupportTicketBase &
  Readonly<{
    status: "RESOLVED";
    assigneeId: string | null;
    assignedAt: Date | null;
    waitingAt: Date | null;
    resolution: string;
    resolvedAt: Date;
    closedAt: null;
  }>;

export type ClosedSupportTicket = SupportTicketBase &
  Readonly<{
    status: "CLOSED";
    assigneeId: string | null;
    assignedAt: Date | null;
    waitingAt: Date | null;
    resolution: string;
    resolvedAt: Date;
    closedAt: Date;
  }>;

export type SupportTicket =
  | OpenSupportTicket
  | AssignedSupportTicket
  | WaitingCustomerSupportTicket
  | ResolvedSupportTicket
  | ClosedSupportTicket;
