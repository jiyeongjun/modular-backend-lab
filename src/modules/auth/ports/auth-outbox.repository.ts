import type { AuthEvent } from "../domain/index.js";

export type AuthOutboxRepository = {
  saveAll(events: readonly AuthEvent[]): Promise<void>;
};
