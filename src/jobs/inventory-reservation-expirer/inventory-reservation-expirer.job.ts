import type { Logger } from "pino";
import type { ExpireReservationsUseCase } from "../../modules/inventory/application/index.js";
import {
  type InventoryReservationExpirerOptions,
  type InventoryReservationExpirerResult,
  processExpiredInventoryReservations,
} from "./inventory-reservation-expirer.processor.js";

export async function runInventoryReservationExpirerJob(deps: {
  expireReservationsUseCase: ExpireReservationsUseCase;
  logger: Logger;
  options?: Partial<InventoryReservationExpirerOptions>;
}): Promise<InventoryReservationExpirerResult> {
  const options: InventoryReservationExpirerOptions = {
    batchSize: deps.options?.batchSize ?? 100,
  };

  deps.logger.info({ job: "inventory-reservation-expirer", options }, "job started");
  const result = await processExpiredInventoryReservations({
    expireReservationsUseCase: deps.expireReservationsUseCase,
    options,
  });
  deps.logger.info({ job: "inventory-reservation-expirer", result }, "job finished");

  return result;
}
