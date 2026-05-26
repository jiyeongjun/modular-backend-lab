import { describe, expect, it } from "vitest";
import { ok } from "../../shared/result/index.js";
import { processFulfillmentStatusSync } from "./fulfillment-status-syncer.processor.js";

describe("processFulfillmentStatusSync", () => {
  it("runs the status sync usecase with an explicit batch size", async () => {
    const requestedBatchSizes: number[] = [];

    const result = await processFulfillmentStatusSync({
      syncFulfillmentStatusesUseCase: async (command) => {
        requestedBatchSizes.push(command.batchSize);
        return ok({ scanned: 3, updated: 2, failed: 1 });
      },
      options: { batchSize: 50 },
    });

    expect(result).toEqual({ scanned: 3, updated: 2, failed: 1 });
    expect(requestedBatchSizes).toEqual([50]);
  });
});
