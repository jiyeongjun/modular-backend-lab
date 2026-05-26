import { err, ok } from "../../../shared/result/index.js";
import type {
  CommitReservationUseCase,
  CommitReservationUseCaseError,
  ReleaseReservationUseCase,
  ReleaseReservationUseCaseError,
  ReserveInventoryUseCase,
  ReserveInventoryUseCaseError,
} from "../../inventory/application/index.js";
import type { InventoryReservation } from "../../inventory/domain/index.js";
import type {
  CheckoutInventoryError,
  CheckoutInventoryPort,
  CheckoutInventoryReservation,
} from "../ports/index.js";

export function createCheckoutInventoryAdapter(deps: {
  reserveInventoryUseCase: ReserveInventoryUseCase;
  commitReservationUseCase: CommitReservationUseCase;
  releaseReservationUseCase: ReleaseReservationUseCase;
}): CheckoutInventoryPort {
  return {
    async reserve(command) {
      const result = await deps.reserveInventoryUseCase(command);
      if (!result.ok) {
        return err(mapInventoryError(result.error));
      }

      return ok(toCheckoutInventoryReservation(result.value.reservation));
    },

    async commit(command) {
      const result = await deps.commitReservationUseCase(command);
      if (!result.ok) {
        return err(mapInventoryError(result.error));
      }

      return ok(toCheckoutInventoryReservation(result.value));
    },

    async release(command) {
      const result = await deps.releaseReservationUseCase(command);
      if (!result.ok) {
        return err(mapInventoryError(result.error));
      }

      return ok(toCheckoutInventoryReservation(result.value));
    },
  };
}

function toCheckoutInventoryReservation(
  reservation: InventoryReservation,
): CheckoutInventoryReservation {
  return {
    reservationId: reservation.id,
    sku: reservation.sku,
    quantity: reservation.quantity,
    status: reservation.status,
  };
}

function mapInventoryError(
  error:
    | ReserveInventoryUseCaseError
    | CommitReservationUseCaseError
    | ReleaseReservationUseCaseError,
): CheckoutInventoryError {
  switch (error.type) {
    case "InventoryItemNotFound":
      return {
        type: "CheckoutInventoryItemNotFound",
        sku: error.sku,
        message: error.message,
      };

    case "InsufficientInventory":
      return {
        type: "CheckoutInsufficientInventory",
        available: error.available,
        requested: error.requested,
        message: error.message,
      };

    case "InvalidReservationExpiry":
    case "InvalidReservationQuantity":
      return {
        type: "CheckoutInvalidInventoryRequest",
        message: error.message,
      };

    case "InventoryInvariantViolation":
    case "InventoryReservationNotFound":
    case "ReservationAlreadyCommitted":
    case "ReservationAlreadyReleased":
    case "ReservationNotCommittable":
    case "ReservationNotReleasable":
      return {
        type: "CheckoutInventoryReservationRejected",
        reason: error.type,
        message: error.message,
      };
  }
}
