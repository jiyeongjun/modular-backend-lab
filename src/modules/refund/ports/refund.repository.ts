import type { Refund, RefundEvent, RequestedRefund } from "../domain/index.js";

export type RefundRepository = {
  findById(id: string): Promise<Refund | null>;
  findByIdForUpdate(id: string): Promise<Refund | null>;
  findByOrderId(orderId: string): Promise<Refund | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Refund | null>;
  create(refund: RequestedRefund, events: readonly RefundEvent[]): Promise<void>;
  save(refund: Refund, events: readonly RefundEvent[]): Promise<void>;
};
