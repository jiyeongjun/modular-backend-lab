import type { ExpireReservationsUseCase } from "../../modules/inventory/application/index.js";

export type InventoryReservationExpirerOptions = Readonly<{
  batchSize: number;
}>;

export type InventoryReservationExpirerResult = Readonly<{
  expired: number;
}>;

export async function processExpiredInventoryReservations(deps: {
  expireReservationsUseCase: ExpireReservationsUseCase;
  options: InventoryReservationExpirerOptions;
}): Promise<InventoryReservationExpirerResult> {
  const result = await deps.expireReservationsUseCase({ batchSize: deps.options.batchSize });
  if (!result.ok) {
    throw new Error("Expire reservations usecase returned an unexpected error");
  }

  return result.value;
}
