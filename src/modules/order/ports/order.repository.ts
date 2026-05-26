import type { Order, OrderEvent, PendingOrder } from "../domain/index.js";

export type OrderRepository = {
  findById(id: string): Promise<Order | null>;
  findByIdForUpdate(id: string): Promise<Order | null>;
  create(order: PendingOrder, events: readonly OrderEvent[]): Promise<void>;
  save(order: Order, events: readonly OrderEvent[]): Promise<void>;
};
