import type { ReturnItem } from "./return-request.js";

export type ReturnRequested = Readonly<{
  type: "ReturnRequested";
  aggregateType: "ReturnRequest";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    returnId: string;
    orderId: string;
    fulfillmentId: string;
    idempotencyKey: string;
    reason: string;
    items: readonly ReturnItem[];
    requestedAt: Date;
  };
}>;

export type ReturnAuthorized = Readonly<{
  type: "ReturnAuthorized";
  aggregateType: "ReturnRequest";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    returnId: string;
    orderId: string;
    fulfillmentId: string;
    rmaNumber: string;
    authorizedAt: Date;
  };
}>;

export type ReturnReceived = Readonly<{
  type: "ReturnReceived";
  aggregateType: "ReturnRequest";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    returnId: string;
    orderId: string;
    fulfillmentId: string;
    rmaNumber: string;
    receivedAt: Date;
  };
}>;

export type ReturnInspectionApproved = Readonly<{
  type: "ReturnInspectionApproved";
  aggregateType: "ReturnRequest";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    returnId: string;
    orderId: string;
    fulfillmentId: string;
    rmaNumber: string;
    restockableItems: readonly ReturnItem[];
    note: string | null;
    inspectedAt: Date;
  };
}>;

export type ReturnInspectionRejected = Readonly<{
  type: "ReturnInspectionRejected";
  aggregateType: "ReturnRequest";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    returnId: string;
    orderId: string;
    fulfillmentId: string;
    rmaNumber: string;
    reason: string;
    note: string | null;
    inspectedAt: Date;
  };
}>;

export type ReturnRequestEvent =
  | ReturnRequested
  | ReturnAuthorized
  | ReturnReceived
  | ReturnInspectionApproved
  | ReturnInspectionRejected;
