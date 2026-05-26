import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type InventoryReservation,
  type ReleaseReservationError,
  releaseReservation,
} from "../domain/index.js";
import type { InventoryUnitOfWork } from "../ports/index.js";

export type ReleaseReservationCommand = Readonly<{
  reservationId: string;
}>;

export type ReleaseReservationUseCaseError =
  | { type: "InventoryReservationNotFound"; reservationId: string; message: string }
  | { type: "InventoryItemNotFound"; sku: string; message: string }
  | ReleaseReservationError;

export type ReleaseReservationUseCase = (
  command: ReleaseReservationCommand,
) => Promise<Result<InventoryReservation, ReleaseReservationUseCaseError>>;

export function createReleaseReservationUseCase(deps: {
  uow: InventoryUnitOfWork;
  now: () => Date;
}): ReleaseReservationUseCase {
  return async function releaseReservationUseCase(command) {
    return deps.uow.withTransaction(async ({ items, reservations, outbox }) => {
      const reservation = await reservations.findByIdForUpdate(command.reservationId);
      if (reservation === null) {
        return err({
          type: "InventoryReservationNotFound",
          reservationId: command.reservationId,
          message: "Inventory reservation was not found",
        });
      }

      const item = await items.findBySkuForUpdate(reservation.sku);
      if (item === null) {
        return err({
          type: "InventoryItemNotFound",
          sku: reservation.sku,
          message: "Inventory item was not found",
        });
      }

      const released = releaseReservation(item, reservation, deps.now());
      if (!released.ok) {
        return released;
      }

      await items.save(released.value.item, released.value.events);
      await reservations.save(released.value.reservation);
      await outbox.saveAll(released.value.events);

      return ok(released.value.reservation);
    });
  };
}
