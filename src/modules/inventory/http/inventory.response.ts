import type { Result } from "../../../shared/result/index.js";
import type {
  CommitReservationUseCaseError,
  ReleaseReservationUseCaseError,
  ReserveInventoryUseCaseError,
  ReserveInventoryUseCaseResult,
} from "../application/index.js";
import type { InventoryReservation } from "../domain/index.js";

export type InventoryHttpResponseShape = Readonly<{
  status: 200 | 201 | 400 | 404 | 409;
  body: unknown;
}>;

export function serializeInventoryReservation(
  reservation: InventoryReservation,
): Record<string, unknown> {
  return {
    id: reservation.id,
    sku: reservation.sku,
    quantity: reservation.quantity,
    status: reservation.status,
    expiresAt: reservation.expiresAt.toISOString(),
    releasedAt: reservation.releasedAt?.toISOString() ?? null,
    committedAt: reservation.committedAt?.toISOString() ?? null,
    expiredAt: reservation.expiredAt?.toISOString() ?? null,
    version: reservation.version,
    createdAt: reservation.createdAt.toISOString(),
    updatedAt: reservation.updatedAt.toISOString(),
  };
}

export function mapReserveInventoryResult(
  result: Result<ReserveInventoryUseCaseResult, ReserveInventoryUseCaseError>,
): InventoryHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializeInventoryReservation(result.value.reservation),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapInventoryError(result.error);
}

export function mapReservationCommandResult(
  result: Result<
    InventoryReservation,
    ReleaseReservationUseCaseError | CommitReservationUseCaseError
  >,
): InventoryHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeInventoryReservation(result.value),
      },
    };
  }

  return mapInventoryError(result.error);
}

function mapInventoryError(error: ReserveInventoryUseCaseError): InventoryHttpResponseShape;
function mapInventoryError(
  error: ReleaseReservationUseCaseError | CommitReservationUseCaseError,
): InventoryHttpResponseShape;
function mapInventoryError(
  error:
    | ReserveInventoryUseCaseError
    | ReleaseReservationUseCaseError
    | CommitReservationUseCaseError,
): InventoryHttpResponseShape {
  switch (error.type) {
    case "InventoryItemNotFound":
    case "InventoryReservationNotFound":
      return {
        status: 404,
        body: { error },
      };

    case "InvalidReservationQuantity":
    case "InvalidReservationExpiry":
      return {
        status: 400,
        body: { error },
      };

    case "InsufficientInventory":
    case "ReservationAlreadyReleased":
    case "ReservationAlreadyCommitted":
    case "ReservationNotReleasable":
    case "ReservationNotCommittable":
    case "InventoryInvariantViolation":
      return {
        status: 409,
        body: { error },
      };
  }
}
