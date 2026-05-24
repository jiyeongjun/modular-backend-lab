import type { OrderRepository } from "./order.repository.js";
import type { OutboxRepository } from "./outbox.repository.js";

export type OrderUnitOfWork = {
  withTransaction<T>(
    work: (repos: { orders: OrderRepository; outbox: OutboxRepository }) => Promise<T>,
  ): Promise<T>;
};
