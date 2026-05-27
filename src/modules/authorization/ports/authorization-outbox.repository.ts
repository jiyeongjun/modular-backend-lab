import type { AuthorizationEvent } from "../domain/index.js";

export type AuthorizationOutboxRepository = {
  saveAll(events: readonly AuthorizationEvent[]): Promise<void>;
};
