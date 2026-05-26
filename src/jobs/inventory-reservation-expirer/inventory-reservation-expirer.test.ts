import { describe, expect, it } from "vitest";
import { ok } from "../../shared/result/index.js";
import { processExpiredInventoryReservations } from "./inventory-reservation-expirer.processor.js";

describe("processExpiredInventoryReservations", () => {
  it("runs the expiration usecase with an explicit batch size", async () => {
    const requestedBatchSizes: number[] = [];

    const result = await processExpiredInventoryReservations({
      expireReservationsUseCase: async (command) => {
        requestedBatchSizes.push(command.batchSize);
        return ok({ expired: 3 });
      },
      options: { batchSize: 50 },
    });

    expect(result).toEqual({ expired: 3 });
    expect(requestedBatchSizes).toEqual([50]);
  });
});
