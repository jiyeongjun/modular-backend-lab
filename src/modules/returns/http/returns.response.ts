import type { Result } from "../../../shared/result/index.js";
import type {
  AuthorizeReturnUseCaseError,
  AuthorizeReturnUseCaseResult,
  CreateReturnRequestUseCaseError,
  CreateReturnRequestUseCaseResult,
  InspectReturnUseCaseError,
  InspectReturnUseCaseResult,
  ReceiveReturnUseCaseError,
  ReceiveReturnUseCaseResult,
} from "../application/index.js";
import type { ReturnRequest } from "../domain/index.js";

export type ReturnsHttpResponseShape = Readonly<{
  status: 200 | 201 | 400 | 404 | 409;
  body: unknown;
}>;

export function serializeReturnRequest(returnRequest: ReturnRequest): Record<string, unknown> {
  return {
    id: returnRequest.id,
    orderId: returnRequest.orderId,
    fulfillmentId: returnRequest.fulfillmentId,
    idempotencyKey: returnRequest.idempotencyKey,
    status: returnRequest.status,
    rmaNumber: returnRequest.rmaNumber,
    reason: returnRequest.reason,
    items: returnRequest.items,
    restockableItems: returnRequest.restockableItems,
    inspectionNote: returnRequest.inspectionNote,
    rejectionReason: returnRequest.rejectionReason,
    requestedAt: returnRequest.requestedAt.toISOString(),
    authorizedAt: returnRequest.authorizedAt?.toISOString() ?? null,
    receivedAt: returnRequest.receivedAt?.toISOString() ?? null,
    inspectedAt: returnRequest.inspectedAt?.toISOString() ?? null,
    version: returnRequest.version,
    createdAt: returnRequest.createdAt.toISOString(),
    updatedAt: returnRequest.updatedAt.toISOString(),
  };
}

export function mapCreateReturnRequestResult(
  result: Result<CreateReturnRequestUseCaseResult, CreateReturnRequestUseCaseError>,
): ReturnsHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializeReturnRequest(result.value.returnRequest),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapReturnsError(result.error);
}

export function mapAuthorizeReturnResult(
  result: Result<AuthorizeReturnUseCaseResult, AuthorizeReturnUseCaseError>,
): ReturnsHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeReturnRequest(result.value.returnRequest),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapReturnsError(result.error);
}

export function mapReceiveReturnResult(
  result: Result<ReceiveReturnUseCaseResult, ReceiveReturnUseCaseError>,
): ReturnsHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeReturnRequest(result.value.returnRequest),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapReturnsError(result.error);
}

export function mapInspectReturnResult(
  result: Result<InspectReturnUseCaseResult, InspectReturnUseCaseError>,
): ReturnsHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeReturnRequest(result.value.returnRequest),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapReturnsError(result.error);
}

function mapReturnsError(
  error:
    | CreateReturnRequestUseCaseError
    | AuthorizeReturnUseCaseError
    | ReceiveReturnUseCaseError
    | InspectReturnUseCaseError,
): ReturnsHttpResponseShape {
  switch (error.type) {
    case "InvalidReturnInput":
    case "ReturnInspectionItemNotRequested":
    case "ReturnInspectionRestockQuantityExceeded":
      return { status: 400, body: { error } };

    case "ReturnRequestNotFound":
      return { status: 404, body: { error } };

    case "ReturnNotAuthorizable":
    case "ReturnNotReceivable":
    case "ReturnNotInspectable":
    case "ReturnRequestIdempotencyConflict":
      return { status: 409, body: { error } };
  }
}
