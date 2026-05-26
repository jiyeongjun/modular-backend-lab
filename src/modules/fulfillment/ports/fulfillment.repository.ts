import type { Fulfillment, ReadyFulfillment, TrackableFulfillment } from "../domain/index.js";

export type FulfillmentRepository = {
  findById(id: string): Promise<Fulfillment | null>;
  findByIdForUpdate(id: string): Promise<Fulfillment | null>;
  findByOrderId(orderId: string): Promise<Fulfillment | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Fulfillment | null>;
  findByLabelIdempotencyKey(idempotencyKey: string): Promise<Fulfillment | null>;
  create(fulfillment: ReadyFulfillment): Promise<void>;
  save(fulfillment: Fulfillment): Promise<void>;
};

export type FulfillmentReader = {
  iterateTrackable(options: { batchSize: number }): AsyncIterable<TrackableFulfillment>;
};
