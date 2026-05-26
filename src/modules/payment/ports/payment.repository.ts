import type { Payment, PaymentEvent, PendingPayment } from "../domain/index.js";

export type PaymentRepository = {
  findById(id: string): Promise<Payment | null>;
  findByIdForUpdate(id: string): Promise<Payment | null>;
  findByOrderId(orderId: string): Promise<Payment | null>;
  findByConfirmIdempotencyKey(idempotencyKey: string): Promise<Payment | null>;
  findByCancelIdempotencyKey(idempotencyKey: string): Promise<Payment | null>;
  create(payment: PendingPayment, events: readonly PaymentEvent[]): Promise<void>;
  save(payment: Payment, events: readonly PaymentEvent[]): Promise<void>;
};
