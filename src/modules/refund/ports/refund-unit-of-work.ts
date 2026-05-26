import type { RefundRepository } from "./refund.repository.js";
import type { RefundOutboxRepository } from "./refund-outbox.repository.js";

export type RefundTransaction = Readonly<{
  refunds: RefundRepository;
  outbox: RefundOutboxRepository;
}>;

export type RefundUnitOfWork = {
  withTransaction<T>(work: (transaction: RefundTransaction) => Promise<T>): Promise<T>;
};
