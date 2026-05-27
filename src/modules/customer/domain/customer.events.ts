export type CustomerRegistered = Readonly<{
  type: "CustomerRegistered";
  aggregateType: "Customer";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    customerId: string;
    idempotencyKey: string;
    email: string;
    displayName: string;
    registeredAt: Date;
  };
}>;

export type CustomerSuspended = Readonly<{
  type: "CustomerSuspended";
  aggregateType: "Customer";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    customerId: string;
    email: string;
    reason: string;
    suspendedAt: Date;
  };
}>;

export type CustomerReactivated = Readonly<{
  type: "CustomerReactivated";
  aggregateType: "Customer";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    customerId: string;
    email: string;
    reactivatedAt: Date;
  };
}>;

export type CustomerClosed = Readonly<{
  type: "CustomerClosed";
  aggregateType: "Customer";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    customerId: string;
    email: string;
    reason: string;
    closedAt: Date;
  };
}>;

export type CustomerEvent =
  | CustomerRegistered
  | CustomerSuspended
  | CustomerReactivated
  | CustomerClosed;
