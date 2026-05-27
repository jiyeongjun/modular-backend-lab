import type { Customer, CustomerEvent } from "../domain/index.js";

export type CustomerRepository = {
  findById(id: string): Promise<Customer | null>;
  findByIdForUpdate(id: string): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Customer | null>;
  create(customer: Customer, events: readonly CustomerEvent[]): Promise<void>;
  save(customer: Customer, events: readonly CustomerEvent[]): Promise<void>;
};
