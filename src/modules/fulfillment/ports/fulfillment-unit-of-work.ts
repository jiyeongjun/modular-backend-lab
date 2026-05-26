import type { FulfillmentRepository } from "./fulfillment.repository.js";
import type { FulfillmentOutboxRepository } from "./fulfillment-outbox.repository.js";

export type FulfillmentTransaction = Readonly<{
  fulfillments: FulfillmentRepository;
  outbox: FulfillmentOutboxRepository;
}>;

export type FulfillmentUnitOfWork = {
  withTransaction<T>(work: (transaction: FulfillmentTransaction) => Promise<T>): Promise<T>;
};
