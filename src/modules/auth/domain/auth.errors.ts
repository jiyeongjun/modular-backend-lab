import type { EmailCredentialStatus } from "./auth-credential.js";
import type { AuthSessionStatus } from "./auth-session.js";

export type InvalidAuthInput = Readonly<{
  type: "InvalidAuthInput";
  field:
    | "id"
    | "customerId"
    | "credentialId"
    | "idempotencyKey"
    | "email"
    | "password"
    | "passwordHash"
    | "sessionId"
    | "token"
    | "tokenHash"
    | "expiresAt";
  message: string;
}>;

export type AuthCredentialNotUsable = Readonly<{
  type: "AuthCredentialNotUsable";
  status: EmailCredentialStatus;
  message: string;
}>;

export type AuthSessionNotUsable = Readonly<{
  type: "AuthSessionNotUsable";
  status: AuthSessionStatus;
  message: string;
}>;

export type CreateEmailCredentialError = InvalidAuthInput;
export type RecordLoginSucceededError = AuthCredentialNotUsable;
export type RecordLoginFailedError = AuthCredentialNotUsable;
export type DisableEmailCredentialError = never;
export type CreateAuthSessionError = InvalidAuthInput;
export type RevokeAuthSessionError = AuthSessionNotUsable;
export type ExpireAuthSessionError = AuthSessionNotUsable;
