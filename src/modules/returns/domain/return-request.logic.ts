import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  AuthorizeReturnError,
  CreateReturnRequestError,
  InspectReturnError,
  InvalidReturnInput,
  ReceiveReturnError,
} from "./return-request.errors.js";
import type { ReturnRequestEvent } from "./return-request.events.js";
import type {
  ApprovedReturnRequest,
  AuthorizedReturnRequest,
  ReceivedReturnRequest,
  RejectedReturnRequest,
  RequestedReturnRequest,
  ReturnItem,
  ReturnRequest,
} from "./return-request.js";

export type CreateReturnRequestInput = Readonly<{
  id: string;
  orderId: string;
  fulfillmentId: string;
  idempotencyKey: string;
  reason: string;
  items: readonly ReturnItem[];
  now: Date;
}>;

export type ReturnRequestTransition<T extends ReturnRequest> = Readonly<{
  returnRequest: T;
  events: readonly ReturnRequestEvent[];
}>;

export function createReturnRequest(
  input: CreateReturnRequestInput,
): Result<RequestedReturnRequest, CreateReturnRequestError> {
  const invalidInput = validateCreateInput(input);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  return ok({
    id: input.id,
    orderId: input.orderId,
    fulfillmentId: input.fulfillmentId,
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
    items: input.items,
    status: "REQUESTED",
    rmaNumber: null,
    requestedAt: input.now,
    authorizedAt: null,
    receivedAt: null,
    inspectedAt: null,
    restockableItems: null,
    inspectionNote: null,
    rejectionReason: null,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function returnRequestedEvent(returnRequest: RequestedReturnRequest): ReturnRequestEvent {
  return {
    type: "ReturnRequested",
    aggregateType: "ReturnRequest",
    aggregateId: returnRequest.id,
    occurredAt: returnRequest.requestedAt,
    payload: {
      returnId: returnRequest.id,
      orderId: returnRequest.orderId,
      fulfillmentId: returnRequest.fulfillmentId,
      idempotencyKey: returnRequest.idempotencyKey,
      reason: returnRequest.reason,
      items: returnRequest.items,
      requestedAt: returnRequest.requestedAt,
    },
  };
}

export function authorizeReturn(
  returnRequest: ReturnRequest,
  input: Readonly<{ rmaNumber: string; now: Date }>,
): Result<ReturnRequestTransition<AuthorizedReturnRequest>, AuthorizeReturnError> {
  if (input.rmaNumber.trim().length === 0) {
    return err({ type: "InvalidReturnInput", message: "RMA number is required" });
  }

  switch (returnRequest.status) {
    case "REQUESTED": {
      const authorized: AuthorizedReturnRequest = {
        ...returnRequest,
        status: "AUTHORIZED",
        rmaNumber: input.rmaNumber,
        authorizedAt: input.now,
        updatedAt: input.now,
      };
      return ok({
        returnRequest: authorized,
        events: [
          {
            type: "ReturnAuthorized",
            aggregateType: "ReturnRequest",
            aggregateId: authorized.id,
            occurredAt: input.now,
            payload: {
              returnId: authorized.id,
              orderId: authorized.orderId,
              fulfillmentId: authorized.fulfillmentId,
              rmaNumber: authorized.rmaNumber,
              authorizedAt: authorized.authorizedAt,
            },
          },
        ],
      });
    }

    case "AUTHORIZED":
      return ok({ returnRequest, events: [] });

    case "RECEIVED":
    case "APPROVED":
    case "REJECTED":
      return err({
        type: "ReturnNotAuthorizable",
        status: returnRequest.status,
        message: "Return request cannot be authorized from its current status",
      });
  }
}

export function receiveReturn(
  returnRequest: ReturnRequest,
  now: Date,
): Result<ReturnRequestTransition<ReceivedReturnRequest>, ReceiveReturnError> {
  switch (returnRequest.status) {
    case "AUTHORIZED": {
      const received: ReceivedReturnRequest = {
        ...returnRequest,
        status: "RECEIVED",
        receivedAt: now,
        updatedAt: now,
      };
      return ok({
        returnRequest: received,
        events: [
          {
            type: "ReturnReceived",
            aggregateType: "ReturnRequest",
            aggregateId: received.id,
            occurredAt: now,
            payload: {
              returnId: received.id,
              orderId: received.orderId,
              fulfillmentId: received.fulfillmentId,
              rmaNumber: received.rmaNumber,
              receivedAt: received.receivedAt,
            },
          },
        ],
      });
    }

    case "RECEIVED":
      return ok({ returnRequest, events: [] });

    case "REQUESTED":
    case "APPROVED":
    case "REJECTED":
      return err({
        type: "ReturnNotReceivable",
        status: returnRequest.status,
        message: "Return request cannot be received from its current status",
      });
  }
}

export type InspectReturnInput = Readonly<{
  accepted: boolean;
  restockableItems: readonly ReturnItem[];
  note: string | null;
  rejectionReason: string | null;
  now: Date;
}>;

export function inspectReturn(
  returnRequest: ReturnRequest,
  input: InspectReturnInput,
): Result<
  ReturnRequestTransition<ApprovedReturnRequest | RejectedReturnRequest>,
  InspectReturnError
> {
  switch (returnRequest.status) {
    case "RECEIVED":
      return input.accepted
        ? approveInspection(returnRequest, input)
        : rejectInspection(returnRequest, input);

    case "APPROVED":
    case "REJECTED":
      return ok({ returnRequest, events: [] });

    case "REQUESTED":
    case "AUTHORIZED":
      return err({
        type: "ReturnNotInspectable",
        status: returnRequest.status,
        message: "Return request cannot be inspected from its current status",
      });
  }
}

function approveInspection(
  returnRequest: ReceivedReturnRequest,
  input: InspectReturnInput,
): Result<ReturnRequestTransition<ApprovedReturnRequest>, InspectReturnError> {
  if (input.rejectionReason !== null && input.rejectionReason.trim().length > 0) {
    return err({
      type: "InvalidReturnInput",
      message: "Approved return inspections cannot include a rejection reason",
    });
  }

  const invalidItems = validateReturnItems(input.restockableItems);
  if (invalidItems !== null) {
    return err(invalidItems);
  }

  const restockValidation = validateRestockableItems(returnRequest.items, input.restockableItems);
  if (restockValidation !== null) {
    return err(restockValidation);
  }

  const approved: ApprovedReturnRequest = {
    ...returnRequest,
    status: "APPROVED",
    inspectedAt: input.now,
    restockableItems: input.restockableItems,
    inspectionNote: input.note,
    rejectionReason: null,
    updatedAt: input.now,
  };
  return ok({
    returnRequest: approved,
    events: [
      {
        type: "ReturnInspectionApproved",
        aggregateType: "ReturnRequest",
        aggregateId: approved.id,
        occurredAt: input.now,
        payload: {
          returnId: approved.id,
          orderId: approved.orderId,
          fulfillmentId: approved.fulfillmentId,
          rmaNumber: approved.rmaNumber,
          restockableItems: approved.restockableItems,
          note: approved.inspectionNote,
          inspectedAt: approved.inspectedAt,
        },
      },
    ],
  });
}

function rejectInspection(
  returnRequest: ReceivedReturnRequest,
  input: InspectReturnInput,
): Result<ReturnRequestTransition<RejectedReturnRequest>, InspectReturnError> {
  if (input.rejectionReason === null || input.rejectionReason.trim().length === 0) {
    return err({
      type: "InvalidReturnInput",
      message: "Rejected return inspections must include a rejection reason",
    });
  }

  if (input.restockableItems.length > 0) {
    return err({
      type: "InvalidReturnInput",
      message: "Rejected return inspections cannot include restockable items",
    });
  }

  const rejected: RejectedReturnRequest = {
    ...returnRequest,
    status: "REJECTED",
    inspectedAt: input.now,
    restockableItems: null,
    inspectionNote: input.note,
    rejectionReason: input.rejectionReason,
    updatedAt: input.now,
  };
  return ok({
    returnRequest: rejected,
    events: [
      {
        type: "ReturnInspectionRejected",
        aggregateType: "ReturnRequest",
        aggregateId: rejected.id,
        occurredAt: input.now,
        payload: {
          returnId: rejected.id,
          orderId: rejected.orderId,
          fulfillmentId: rejected.fulfillmentId,
          rmaNumber: rejected.rmaNumber,
          reason: rejected.rejectionReason,
          note: rejected.inspectionNote,
          inspectedAt: rejected.inspectedAt,
        },
      },
    ],
  });
}

function validateCreateInput(input: CreateReturnRequestInput): InvalidReturnInput | null {
  const requiredFields = [
    input.id,
    input.orderId,
    input.fulfillmentId,
    input.idempotencyKey,
    input.reason,
  ];
  if (requiredFields.some((value) => value.trim().length === 0)) {
    return { type: "InvalidReturnInput", message: "Return request fields must be non-empty" };
  }

  if (input.items.length === 0) {
    return { type: "InvalidReturnInput", message: "Return request must include at least one item" };
  }

  return validateReturnItems(input.items);
}

function validateReturnItems(items: readonly ReturnItem[]): InvalidReturnInput | null {
  const seenSkus = new Set<string>();
  for (const item of items) {
    if (item.sku.trim().length === 0 || item.quantity <= 0) {
      return {
        type: "InvalidReturnInput",
        message: "Return items must include non-empty SKU and positive quantity",
      };
    }

    if (seenSkus.has(item.sku)) {
      return {
        type: "InvalidReturnInput",
        message: "Return items must not contain duplicate SKUs",
      };
    }
    seenSkus.add(item.sku);
  }

  return null;
}

function validateRestockableItems(
  requestedItems: readonly ReturnItem[],
  restockableItems: readonly ReturnItem[],
): InspectReturnError | null {
  for (const restockableItem of restockableItems) {
    const requestedItem = requestedItems.find((item) => item.sku === restockableItem.sku);
    if (requestedItem === undefined) {
      return {
        type: "ReturnInspectionItemNotRequested",
        sku: restockableItem.sku,
        message: "Restockable item was not part of the return request",
      };
    }

    if (restockableItem.quantity > requestedItem.quantity) {
      return {
        type: "ReturnInspectionRestockQuantityExceeded",
        sku: restockableItem.sku,
        requestedQuantity: requestedItem.quantity,
        restockableQuantity: restockableItem.quantity,
        message: "Restockable quantity cannot exceed requested return quantity",
      };
    }
  }

  return null;
}
