import type { ReturnRequest, ReturnRequestEvent } from "../domain/index.js";

export type ReturnRequestRepository = {
  findById(id: string): Promise<ReturnRequest | null>;
  findByIdForUpdate(id: string): Promise<ReturnRequest | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<ReturnRequest | null>;
  create(returnRequest: ReturnRequest, events: readonly ReturnRequestEvent[]): Promise<void>;
  save(returnRequest: ReturnRequest, events: readonly ReturnRequestEvent[]): Promise<void>;
};
