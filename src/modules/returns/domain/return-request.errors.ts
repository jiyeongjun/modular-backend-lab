import type { ReturnStatus } from "./return-request.js";

export type InvalidReturnInput = Readonly<{
  type: "InvalidReturnInput";
  message: string;
}>;

export type ReturnNotAuthorizable = Readonly<{
  type: "ReturnNotAuthorizable";
  status: ReturnStatus;
  message: string;
}>;

export type ReturnNotReceivable = Readonly<{
  type: "ReturnNotReceivable";
  status: ReturnStatus;
  message: string;
}>;

export type ReturnNotInspectable = Readonly<{
  type: "ReturnNotInspectable";
  status: ReturnStatus;
  message: string;
}>;

export type ReturnInspectionItemNotRequested = Readonly<{
  type: "ReturnInspectionItemNotRequested";
  sku: string;
  message: string;
}>;

export type ReturnInspectionRestockQuantityExceeded = Readonly<{
  type: "ReturnInspectionRestockQuantityExceeded";
  sku: string;
  requestedQuantity: number;
  restockableQuantity: number;
  message: string;
}>;

export type CreateReturnRequestError = InvalidReturnInput;

export type AuthorizeReturnError = InvalidReturnInput | ReturnNotAuthorizable;

export type ReceiveReturnError = ReturnNotReceivable;

export type InspectReturnError =
  | InvalidReturnInput
  | ReturnInspectionItemNotRequested
  | ReturnInspectionRestockQuantityExceeded
  | ReturnNotInspectable;
