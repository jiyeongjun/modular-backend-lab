import type { AuthEvent, EmailCredential } from "../domain/index.js";

export type AuthCredentialRepository = {
  findById(id: string): Promise<EmailCredential | null>;
  findByIdForUpdate(id: string): Promise<EmailCredential | null>;
  findByEmail(email: string): Promise<EmailCredential | null>;
  findByEmailForUpdate(email: string): Promise<EmailCredential | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<EmailCredential | null>;
  create(credential: EmailCredential, events: readonly AuthEvent[]): Promise<void>;
  save(credential: EmailCredential, events: readonly AuthEvent[]): Promise<void>;
};
