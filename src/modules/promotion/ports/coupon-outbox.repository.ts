import type { CouponEvent } from "../domain/index.js";

export type CouponOutboxRepository = {
  saveAll(events: readonly CouponEvent[]): Promise<void>;
};
