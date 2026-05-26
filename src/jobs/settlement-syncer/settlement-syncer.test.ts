import { describe, expect, it } from "vitest";
import { ok } from "../../shared/result/index.js";
import { processSettlementSync } from "./settlement-syncer.processor.js";

describe("processSettlementSync", () => {
  it("runs the settlement sync usecase with an explicit batch size", async () => {
    const requestedBatchSizes: number[] = [];

    const result = await processSettlementSync({
      syncPendingSettlementsUseCase: async (command) => {
        requestedBatchSizes.push(command.batchSize);
        return ok({ scanned: 3, synced: 2, failed: 1 });
      },
      options: { batchSize: 50 },
    });

    expect(result).toEqual({ scanned: 3, synced: 2, failed: 1 });
    expect(requestedBatchSizes).toEqual([50]);
  });
});
