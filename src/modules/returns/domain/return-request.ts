export type ReturnStatus = "REQUESTED" | "AUTHORIZED" | "RECEIVED" | "APPROVED" | "REJECTED";

export type ReturnItem = Readonly<{
  sku: string;
  quantity: number;
}>;

type ReturnRequestBase = Readonly<{
  id: string;
  orderId: string;
  fulfillmentId: string;
  idempotencyKey: string;
  reason: string;
  items: readonly ReturnItem[];
  requestedAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type RequestedReturnRequest = ReturnRequestBase &
  Readonly<{
    status: "REQUESTED";
    rmaNumber: null;
    authorizedAt: null;
    receivedAt: null;
    inspectedAt: null;
    restockableItems: null;
    inspectionNote: null;
    rejectionReason: null;
  }>;

export type AuthorizedReturnRequest = ReturnRequestBase &
  Readonly<{
    status: "AUTHORIZED";
    rmaNumber: string;
    authorizedAt: Date;
    receivedAt: null;
    inspectedAt: null;
    restockableItems: null;
    inspectionNote: null;
    rejectionReason: null;
  }>;

export type ReceivedReturnRequest = ReturnRequestBase &
  Readonly<{
    status: "RECEIVED";
    rmaNumber: string;
    authorizedAt: Date;
    receivedAt: Date;
    inspectedAt: null;
    restockableItems: null;
    inspectionNote: null;
    rejectionReason: null;
  }>;

export type ApprovedReturnRequest = ReturnRequestBase &
  Readonly<{
    status: "APPROVED";
    rmaNumber: string;
    authorizedAt: Date;
    receivedAt: Date;
    inspectedAt: Date;
    restockableItems: readonly ReturnItem[];
    inspectionNote: string | null;
    rejectionReason: null;
  }>;

export type RejectedReturnRequest = ReturnRequestBase &
  Readonly<{
    status: "REJECTED";
    rmaNumber: string;
    authorizedAt: Date;
    receivedAt: Date;
    inspectedAt: Date;
    restockableItems: null;
    inspectionNote: string | null;
    rejectionReason: string;
  }>;

export type ReturnRequest =
  | RequestedReturnRequest
  | AuthorizedReturnRequest
  | ReceivedReturnRequest
  | ApprovedReturnRequest
  | RejectedReturnRequest;
