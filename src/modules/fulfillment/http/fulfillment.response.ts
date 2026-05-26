import type { Result } from "../../../shared/result/index.js";
import type {
  CancelFulfillmentUseCaseError,
  CancelFulfillmentUseCaseResult,
  CreateFulfillmentUseCaseError,
  CreateFulfillmentUseCaseResult,
  MarkFulfillmentPackedUseCaseError,
  MarkFulfillmentPackedUseCaseResult,
  PurchaseShippingLabelUseCaseError,
  PurchaseShippingLabelUseCaseResult,
  SyncFulfillmentCarrierStatusUseCaseError,
  SyncFulfillmentCarrierStatusUseCaseResult,
} from "../application/index.js";
import type { Fulfillment } from "../domain/index.js";

export type FulfillmentHttpResponseShape = Readonly<{
  status: 200 | 201 | 400 | 404 | 409 | 502 | 503;
  body: unknown;
}>;

export function serializeFulfillment(fulfillment: Fulfillment): Record<string, unknown> {
  return {
    id: fulfillment.id,
    orderId: fulfillment.orderId,
    status: fulfillment.status,
    recipient: fulfillment.recipient,
    package: fulfillment.package,
    carrier: fulfillment.carrier,
    carrierShipmentId: fulfillment.carrierShipmentId,
    trackingNumber: fulfillment.trackingNumber,
    carrierStatus: fulfillment.carrierStatus,
    packedAt: fulfillment.packedAt?.toISOString() ?? null,
    labelPurchasedAt: fulfillment.labelPurchasedAt?.toISOString() ?? null,
    shippedAt: fulfillment.shippedAt?.toISOString() ?? null,
    deliveredAt: fulfillment.deliveredAt?.toISOString() ?? null,
    cancelledAt: fulfillment.cancelledAt?.toISOString() ?? null,
    cancelReason: fulfillment.cancelReason,
    version: fulfillment.version,
    createdAt: fulfillment.createdAt.toISOString(),
    updatedAt: fulfillment.updatedAt.toISOString(),
  };
}

export function mapCreateFulfillmentResult(
  result: Result<CreateFulfillmentUseCaseResult, CreateFulfillmentUseCaseError>,
): FulfillmentHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializeFulfillment(result.value.fulfillment),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapFulfillmentError(result.error);
}

export function mapMarkFulfillmentPackedResult(
  result: Result<MarkFulfillmentPackedUseCaseResult, MarkFulfillmentPackedUseCaseError>,
): FulfillmentHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeFulfillment(result.value.fulfillment),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapFulfillmentError(result.error);
}

export function mapPurchaseShippingLabelResult(
  result: Result<PurchaseShippingLabelUseCaseResult, PurchaseShippingLabelUseCaseError>,
): FulfillmentHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializeFulfillment(result.value.fulfillment),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapFulfillmentError(result.error);
}

export function mapCancelFulfillmentResult(
  result: Result<CancelFulfillmentUseCaseResult, CancelFulfillmentUseCaseError>,
): FulfillmentHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeFulfillment(result.value.fulfillment),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapFulfillmentError(result.error);
}

export function mapSyncFulfillmentCarrierStatusResult(
  result: Result<
    SyncFulfillmentCarrierStatusUseCaseResult,
    SyncFulfillmentCarrierStatusUseCaseError
  >,
): FulfillmentHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeFulfillment(result.value.fulfillment),
        updated: result.value.updated,
      },
    };
  }

  return mapFulfillmentError(result.error);
}

function mapFulfillmentError(error: CreateFulfillmentUseCaseError): FulfillmentHttpResponseShape;
function mapFulfillmentError(
  error: MarkFulfillmentPackedUseCaseError,
): FulfillmentHttpResponseShape;
function mapFulfillmentError(
  error: PurchaseShippingLabelUseCaseError,
): FulfillmentHttpResponseShape;
function mapFulfillmentError(error: CancelFulfillmentUseCaseError): FulfillmentHttpResponseShape;
function mapFulfillmentError(
  error: SyncFulfillmentCarrierStatusUseCaseError,
): FulfillmentHttpResponseShape;
function mapFulfillmentError(
  error:
    | CreateFulfillmentUseCaseError
    | MarkFulfillmentPackedUseCaseError
    | PurchaseShippingLabelUseCaseError
    | CancelFulfillmentUseCaseError
    | SyncFulfillmentCarrierStatusUseCaseError,
): FulfillmentHttpResponseShape {
  switch (error.type) {
    case "InvalidFulfillmentInput":
    case "InvalidFulfillmentPackage":
    case "InvalidShippingLabel":
      return {
        status: 400,
        body: { error },
      };

    case "FulfillmentNotFound":
      return {
        status: 404,
        body: { error },
      };

    case "ShippingCarrierRejected":
      return {
        status: error.retryable ? 503 : 502,
        body: { error },
      };

    case "FulfillmentAlreadyExists":
    case "FulfillmentLabelAlreadyPurchased":
    case "FulfillmentNotCancellable":
    case "FulfillmentNotLabelable":
    case "FulfillmentNotPackable":
    case "FulfillmentNotTrackable":
    case "UnsupportedCarrierStatusTransition":
      return {
        status: 409,
        body: { error },
      };
  }
}
