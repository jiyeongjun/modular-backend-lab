import type { AuthEvent, AuthSession } from "../domain/index.js";

export type AuthSessionRepository = {
  findById(id: string): Promise<AuthSession | null>;
  findByIdForUpdate(id: string): Promise<AuthSession | null>;
  findByTokenHash(tokenHash: string): Promise<AuthSession | null>;
  findByTokenHashForUpdate(tokenHash: string): Promise<AuthSession | null>;
  create(session: AuthSession, events: readonly AuthEvent[]): Promise<void>;
  save(session: AuthSession, events: readonly AuthEvent[]): Promise<void>;
};
