import type { SupportTicketStatus } from "./support-ticket.js";

export type InvalidSupportTicketInput = Readonly<{
  type: "InvalidSupportTicketInput";
  field:
    | "id"
    | "customerId"
    | "idempotencyKey"
    | "subject"
    | "description"
    | "assigneeId"
    | "resolution";
  message: string;
}>;

export type SupportTicketNotAssignable = Readonly<{
  type: "SupportTicketNotAssignable";
  status: SupportTicketStatus;
  message: string;
}>;

export type SupportTicketNotWaitable = Readonly<{
  type: "SupportTicketNotWaitable";
  status: SupportTicketStatus;
  message: string;
}>;

export type SupportTicketNotResolvable = Readonly<{
  type: "SupportTicketNotResolvable";
  status: SupportTicketStatus;
  message: string;
}>;

export type SupportTicketNotClosable = Readonly<{
  type: "SupportTicketNotClosable";
  status: SupportTicketStatus;
  message: string;
}>;

export type CreateSupportTicketError = InvalidSupportTicketInput;

export type AssignSupportTicketError = InvalidSupportTicketInput | SupportTicketNotAssignable;

export type MarkSupportTicketWaitingError = SupportTicketNotWaitable;

export type ResolveSupportTicketError = InvalidSupportTicketInput | SupportTicketNotResolvable;

export type CloseSupportTicketError = SupportTicketNotClosable;
