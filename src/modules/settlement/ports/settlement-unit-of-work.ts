import type { SettlementRepository } from "./settlement.repository.js";
import type { SettlementOutboxRepository } from "./settlement-outbox.repository.js";

export type SettlementTransaction = Readonly<{
  settlements: SettlementRepository;
  outbox: SettlementOutboxRepository;
}>;

export type SettlementUnitOfWork = {
  withTransaction<T>(work: (transaction: SettlementTransaction) => Promise<T>): Promise<T>;
};
