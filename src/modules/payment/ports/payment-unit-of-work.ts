import type { PaymentRepository } from "./payment.repository.js";
import type { PaymentOutboxRepository } from "./payment-outbox.repository.js";

export type PaymentTransaction = Readonly<{
  payments: PaymentRepository;
  outbox: PaymentOutboxRepository;
}>;

export type PaymentUnitOfWork = {
  withTransaction<T>(work: (transaction: PaymentTransaction) => Promise<T>): Promise<T>;
};
