import { ok, type Result } from "../../../shared/result/index.js";
import { expireReservation } from "../domain/index.js";
import type { InventoryReservationReader, InventoryUnitOfWork } from "../ports/index.js";

export type ExpireReservationsCommand = Readonly<{
  batchSize: number;
}>;

export type ExpireReservationsResult = Readonly<{
  expired: number;
}>;

export type ExpireReservationsUseCase = (
  command: ExpireReservationsCommand,
) => Promise<Result<ExpireReservationsResult, never>>;

export function createExpireReservationsUseCase(deps: {
  reader: InventoryReservationReader;
  uow: InventoryUnitOfWork;
  now: () => Date;
}): ExpireReservationsUseCase {
  return async function expireReservationsUseCase(command) {
    const now = deps.now();
    let expiredCount = 0;

    for await (const candidate of deps.reader.iterateExpiredActive({
      now,
      batchSize: command.batchSize,
    })) {
      const result = await deps.uow.withTransaction(async ({ items, reservations, outbox }) => {
        const reservation = await reservations.findByIdForUpdate(candidate.id);
        if (
          reservation === null ||
          reservation.status !== "ACTIVE" ||
          reservation.expiresAt > now
        ) {
          return false;
        }

        const item = await items.findBySkuForUpdate(reservation.sku);
        if (item === null) {
          return false;
        }

        const expired = expireReservation(item, reservation, now);
        if (!expired.ok) {
          return false;
        }

        await items.save(expired.value.item, expired.value.events);
        await reservations.save(expired.value.reservation);
        await outbox.saveAll(expired.value.events);

        return true;
      });

      if (result) {
        expiredCount += 1;
      }
    }

    return ok({ expired: expiredCount });
  };
}
