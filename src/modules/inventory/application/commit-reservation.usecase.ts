import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CommitReservationError,
  commitReservation,
  type InventoryReservation,
} from "../domain/index.js";
import type { InventoryUnitOfWork } from "../ports/index.js";

export type CommitReservationCommand = Readonly<{
  reservationId: string;
}>;

export type CommitReservationUseCaseError =
  | { type: "InventoryReservationNotFound"; reservationId: string; message: string }
  | { type: "InventoryItemNotFound"; sku: string; message: string }
  | CommitReservationError;

export type CommitReservationUseCase = (
  command: CommitReservationCommand,
) => Promise<Result<InventoryReservation, CommitReservationUseCaseError>>;

export function createCommitReservationUseCase(deps: {
  uow: InventoryUnitOfWork;
  now: () => Date;
}): CommitReservationUseCase {
  return async function commitReservationUseCase(command) {
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

      const committed = commitReservation(item, reservation, deps.now());
      if (!committed.ok) {
        return committed;
      }

      await items.save(committed.value.item);
      await reservations.save(committed.value.reservation);
      await outbox.saveAll(committed.value.events);

      return ok(committed.value.reservation);
    });
  };
}
