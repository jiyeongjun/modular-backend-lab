import type { SettlementSourceFacts } from "../domain/index.js";

export type SettlementCandidateScan = Readonly<{
  batchSize: number;
}>;

export type SettlementSourceReader = {
  findFactsByOrderId(orderId: string): Promise<SettlementSourceFacts>;
  iterateCandidateOrderIds(options: SettlementCandidateScan): AsyncIterable<string>;
};
