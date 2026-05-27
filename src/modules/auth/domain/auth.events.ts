export type EmailCredentialRegistered = Readonly<{
  type: "EmailCredentialRegistered";
  aggregateType: "EmailCredential";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    credentialId: string;
    customerId: string;
    idempotencyKey: string;
    email: string;
    registeredAt: Date;
  };
}>;

export type EmailCredentialLoginSucceeded = Readonly<{
  type: "EmailCredentialLoginSucceeded";
  aggregateType: "EmailCredential";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    credentialId: string;
    customerId: string;
    email: string;
    loggedInAt: Date;
  };
}>;

export type EmailCredentialLoginFailed = Readonly<{
  type: "EmailCredentialLoginFailed";
  aggregateType: "EmailCredential";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    credentialId: string;
    customerId: string;
    email: string;
    failedLoginCount: number;
    failedAt: Date;
  };
}>;

export type EmailCredentialLocked = Readonly<{
  type: "EmailCredentialLocked";
  aggregateType: "EmailCredential";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    credentialId: string;
    customerId: string;
    email: string;
    failedLoginCount: number;
    lockedAt: Date;
  };
}>;

export type EmailCredentialDisabled = Readonly<{
  type: "EmailCredentialDisabled";
  aggregateType: "EmailCredential";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    credentialId: string;
    customerId: string;
    email: string;
    disabledAt: Date;
  };
}>;

export type AuthSessionIssued = Readonly<{
  type: "AuthSessionIssued";
  aggregateType: "AuthSession";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    sessionId: string;
    credentialId: string;
    customerId: string;
    issuedAt: Date;
    expiresAt: Date;
  };
}>;

export type AuthSessionRevoked = Readonly<{
  type: "AuthSessionRevoked";
  aggregateType: "AuthSession";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    sessionId: string;
    credentialId: string;
    customerId: string;
    revokedAt: Date;
  };
}>;

export type AuthSessionExpired = Readonly<{
  type: "AuthSessionExpired";
  aggregateType: "AuthSession";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    sessionId: string;
    credentialId: string;
    customerId: string;
    expiredAt: Date;
  };
}>;

export type AuthEvent =
  | EmailCredentialRegistered
  | EmailCredentialLoginSucceeded
  | EmailCredentialLoginFailed
  | EmailCredentialLocked
  | EmailCredentialDisabled
  | AuthSessionIssued
  | AuthSessionRevoked
  | AuthSessionExpired;
