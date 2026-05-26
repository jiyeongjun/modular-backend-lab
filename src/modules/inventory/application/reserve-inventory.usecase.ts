import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type InventoryReservation,
  type ReserveInventoryError,
  reserveInventory,
} from "../domain/index.js";
import type { InventoryUnitOfWork } from "../ports/index.js";

export type ReserveInventoryCommand = Readonly<{
  sku: string;
  quantity: number;
  idempotencyKey: string;
  expiresAt: Date;
}>;

export type ReserveInventoryUseCaseError =
  | { type: "InventoryItemNotFound"; sku: string; message: string }
  | ReserveInventoryError;

export type ReserveInventoryUseCaseResult = Readonly<{
  reservation: InventoryReservation;
  idempotent: boolean;
}>;

export type ReserveInventoryUseCase = (
  command: ReserveInventoryCommand,
) => Promise<Result<ReserveInventoryUseCaseResult, ReserveInventoryUseCaseError>>;

export function createReserveInventoryUseCase(deps: {
  uow: InventoryUnitOfWork;
  now: () => Date;
  generateId: () => string;
}): ReserveInventoryUseCase {
  return async function reserveInventoryUseCase(command) {
    return deps.uow.withTransaction(async ({ items, reservations, outbox }) => {
      const existing = await reservations.findByIdempotencyKey(command.idempotencyKey);
      if (existing !== null) {
        return ok({ reservation: existing, idempotent: true });
      }

      const item = await items.findBySkuForUpdate(command.sku);
      if (item === null) {
        return err({
          type: "InventoryItemNotFound",
          sku: command.sku,
          message: "Inventory item was not found",
        });
      }

      const reserved = reserveInventory(item, {
        reservationId: deps.generateId(),
        idempotencyKey: command.idempotencyKey,
        quantity: command.quantity,
        expiresAt: command.expiresAt,
        now: deps.now(),
      });

      if (!reserved.ok) {
        return reserved;
      }

      await items.save(reserved.value.item, reserved.value.events);
      await reservations.create(reserved.value.reservation);
      await outbox.saveAll(reserved.value.events);

      return ok({ reservation: reserved.value.reservation, idempotent: false });
    });
  };
}
