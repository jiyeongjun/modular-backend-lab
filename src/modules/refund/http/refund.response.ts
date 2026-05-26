import type { Result } from "../../../shared/result/index.js";
import type {
  ProcessRefundUseCaseError,
  ProcessRefundUseCaseResult,
  RejectRefundUseCaseError,
  RejectRefundUseCaseResult,
  RequestRefundUseCaseError,
  RequestRefundUseCaseResult,
} from "../application/index.js";
import type { Refund } from "../domain/index.js";

export type RefundHttpResponseShape = Readonly<{
  status: 200 | 201 | 400 | 404 | 409 | 502 | 503;
  body: unknown;
}>;

export function serializeRefund(refund: Refund): Record<string, unknown> {
  return {
    id: refund.id,
    orderId: refund.orderId,
    paymentId: refund.paymentId,
    status: refund.status,
    amount: refund.amount,
    reason: refund.reason,
    returnRequired: refund.returnRequired,
    restock: refund.restock,
    approvedAt: refund.approvedAt?.toISOString() ?? null,
    rejectedAt: refund.rejectedAt?.toISOString() ?? null,
    rejectionReason: refund.rejectionReason,
    paymentRefundedAt: refund.paymentRefundedAt?.toISOString() ?? null,
    restockedAt: refund.restockedAt?.toISOString() ?? null,
    completedAt: refund.completedAt?.toISOString() ?? null,
    version: refund.version,
    createdAt: refund.createdAt.toISOString(),
    updatedAt: refund.updatedAt.toISOString(),
  };
}

export function mapRequestRefundResult(
  result: Result<RequestRefundUseCaseResult, RequestRefundUseCaseError>,
): RefundHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializeRefund(result.value.refund),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapRefundError(result.error);
}

export function mapProcessRefundResult(
  result: Result<ProcessRefundUseCaseResult, ProcessRefundUseCaseError>,
): RefundHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeRefund(result.value.refund),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapRefundError(result.error);
}

export function mapRejectRefundResult(
  result: Result<RejectRefundUseCaseResult, RejectRefundUseCaseError>,
): RefundHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeRefund(result.value.refund),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapRefundError(result.error);
}

function mapRefundError(error: RequestRefundUseCaseError): RefundHttpResponseShape;
function mapRefundError(error: ProcessRefundUseCaseError): RefundHttpResponseShape;
function mapRefundError(error: RejectRefundUseCaseError): RefundHttpResponseShape;
function mapRefundError(
  error: RequestRefundUseCaseError | ProcessRefundUseCaseError | RejectRefundUseCaseError,
): RefundHttpResponseShape {
  switch (error.type) {
    case "InvalidRefundAmount":
    case "InvalidRefundInput":
    case "RefundRestockNotAllowed":
    case "RefundRestockRequired":
      return { status: 400, body: { error } };

    case "RefundNotFound":
      return { status: 404, body: { error } };

    case "RefundPaymentFailed":
      return {
        status:
          error.paymentError.type === "RefundPaymentProviderRejected" &&
          error.paymentError.statusCode === 503
            ? 503
            : 502,
        body: { error },
      };

    case "RefundFulfillmentLookupFailed":
      return { status: 503, body: { error } };

    case "RefundInventoryRestockFailed":
      return { status: 409, body: { error } };

    case "RefundAlreadyExists":
    case "RefundNotApprovable":
    case "RefundNotCompletable":
    case "RefundNotRejectable":
    case "RefundPaymentNotRecordable":
    case "RefundRejected":
    case "RefundRestockNotRecordable":
    case "RefundRestockNotRequired":
    case "RefundReturnRequired":
      return { status: 409, body: { error } };
  }
}
