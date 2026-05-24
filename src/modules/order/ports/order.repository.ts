import type { Order } from "../domain/index.js";

export type OrderRepository = {
  findById(id: string): Promise<Order | null>;
  findByIdForUpdate(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
};
