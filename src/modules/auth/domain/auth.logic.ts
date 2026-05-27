import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  AuthCredentialNotUsable,
  AuthSessionNotUsable,
  CreateAuthSessionError,
  CreateEmailCredentialError,
  ExpireAuthSessionError,
  InvalidAuthInput,
  RecordLoginFailedError,
  RecordLoginSucceededError,
  RevokeAuthSessionError,
} from "./auth.errors.js";
import type { AuthEvent } from "./auth.events.js";
import type {
  ActiveEmailCredential,
  DisabledEmailCredential,
  EmailCredential,
  LockedEmailCredential,
} from "./auth-credential.js";
import type {
  ActiveAuthSession,
  AuthSession,
  ExpiredAuthSession,
  RevokedAuthSession,
} from "./auth-session.js";

const MIN_PASSWORD_LENGTH = 8;

export type CreateEmailCredentialInput = Readonly<{
  id: string;
  customerId: string;
  idempotencyKey: string;
  email: string;
  passwordHash: string;
  now: Date;
}>;

export type CreateAuthSessionInput = Readonly<{
  id: string;
  customerId: string;
  credentialId: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
}>;

export type AuthCredentialTransition<T extends EmailCredential> = Readonly<{
  credential: T;
  events: readonly AuthEvent[];
}>;

export type AuthSessionTransition<T extends AuthSession> = Readonly<{
  session: T;
  events: readonly AuthEvent[];
}>;

export function createEmailCredential(
  input: CreateEmailCredentialInput,
): Result<ActiveEmailCredential, CreateEmailCredentialError> {
  const invalidRequired = validateRequiredFields([
    ["id", input.id],
    ["customerId", input.customerId],
    ["idempotencyKey", input.idempotencyKey],
    ["passwordHash", input.passwordHash],
  ]);
  if (invalidRequired !== null) {
    return err(invalidRequired);
  }

  const email = normalizeAuthEmail(input.email);
  const emailValidation = validateEmail(email);
  if (emailValidation !== null) {
    return err(emailValidation);
  }

  return ok({
    id: input.id,
    customerId: input.customerId.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
    email,
    passwordHash: input.passwordHash,
    status: "ACTIVE",
    failedLoginCount: 0,
    registeredAt: input.now,
    passwordUpdatedAt: input.now,
    lastLoginAt: null,
    lockedAt: null,
    disabledAt: null,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function emailCredentialRegisteredEvent(credential: ActiveEmailCredential): AuthEvent {
  return {
    type: "EmailCredentialRegistered",
    aggregateType: "EmailCredential",
    aggregateId: credential.id,
    occurredAt: credential.registeredAt,
    payload: {
      credentialId: credential.id,
      customerId: credential.customerId,
      idempotencyKey: credential.idempotencyKey,
      email: credential.email,
      registeredAt: credential.registeredAt,
    },
  };
}

export function recordLoginSucceeded(
  credential: EmailCredential,
  now: Date,
): Result<AuthCredentialTransition<ActiveEmailCredential>, RecordLoginSucceededError> {
  switch (credential.status) {
    case "ACTIVE": {
      const active: ActiveEmailCredential = {
        ...credential,
        failedLoginCount: 0,
        lastLoginAt: now,
        updatedAt: now,
      };
      return ok({
        credential: active,
        events: [
          {
            type: "EmailCredentialLoginSucceeded",
            aggregateType: "EmailCredential",
            aggregateId: active.id,
            occurredAt: now,
            payload: {
              credentialId: active.id,
              customerId: active.customerId,
              email: active.email,
              loggedInAt: now,
            },
          },
        ],
      });
    }

    case "LOCKED":
    case "DISABLED":
      return err(notUsableCredential(credential.status));
  }
}

export function recordLoginFailed(
  credential: EmailCredential,
  input: Readonly<{ maxFailedAttempts: number; now: Date }>,
): Result<
  AuthCredentialTransition<ActiveEmailCredential | LockedEmailCredential>,
  RecordLoginFailedError
> {
  if (credential.status !== "ACTIVE") {
    return err(notUsableCredential(credential.status));
  }

  const failedLoginCount = credential.failedLoginCount + 1;
  const failureEvent: AuthEvent = {
    type: "EmailCredentialLoginFailed",
    aggregateType: "EmailCredential",
    aggregateId: credential.id,
    occurredAt: input.now,
    payload: {
      credentialId: credential.id,
      customerId: credential.customerId,
      email: credential.email,
      failedLoginCount,
      failedAt: input.now,
    },
  };

  if (failedLoginCount >= input.maxFailedAttempts) {
    const locked: LockedEmailCredential = {
      ...credential,
      status: "LOCKED",
      failedLoginCount,
      lockedAt: input.now,
      updatedAt: input.now,
    };
    return ok({
      credential: locked,
      events: [
        failureEvent,
        {
          type: "EmailCredentialLocked",
          aggregateType: "EmailCredential",
          aggregateId: locked.id,
          occurredAt: input.now,
          payload: {
            credentialId: locked.id,
            customerId: locked.customerId,
            email: locked.email,
            failedLoginCount: locked.failedLoginCount,
            lockedAt: locked.lockedAt,
          },
        },
      ],
    });
  }

  const active: ActiveEmailCredential = {
    ...credential,
    failedLoginCount,
    updatedAt: input.now,
  };
  return ok({
    credential: active,
    events: [failureEvent],
  });
}

export function disableEmailCredential(
  credential: EmailCredential,
  now: Date,
): AuthCredentialTransition<DisabledEmailCredential> {
  if (credential.status === "DISABLED") {
    return { credential, events: [] };
  }

  const disabled: DisabledEmailCredential = {
    ...credential,
    status: "DISABLED",
    disabledAt: now,
    updatedAt: now,
  };
  return {
    credential: disabled,
    events: [
      {
        type: "EmailCredentialDisabled",
        aggregateType: "EmailCredential",
        aggregateId: disabled.id,
        occurredAt: now,
        payload: {
          credentialId: disabled.id,
          customerId: disabled.customerId,
          email: disabled.email,
          disabledAt: disabled.disabledAt,
        },
      },
    ],
  };
}

export function createAuthSession(
  input: CreateAuthSessionInput,
): Result<ActiveAuthSession, CreateAuthSessionError> {
  const invalidRequired = validateRequiredFields([
    ["sessionId", input.id],
    ["customerId", input.customerId],
    ["credentialId", input.credentialId],
    ["tokenHash", input.tokenHash],
  ]);
  if (invalidRequired !== null) {
    return err(invalidRequired);
  }

  if (input.expiresAt.getTime() <= input.issuedAt.getTime()) {
    return err({
      type: "InvalidAuthInput",
      field: "expiresAt",
      message: "Auth session expiry must be after issue time",
    });
  }

  return ok({
    id: input.id,
    customerId: input.customerId.trim(),
    credentialId: input.credentialId.trim(),
    tokenHash: input.tokenHash,
    status: "ACTIVE",
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    revokedAt: null,
    expiredAt: null,
    version: 0,
    createdAt: input.issuedAt,
    updatedAt: input.issuedAt,
  });
}

export function authSessionIssuedEvent(session: ActiveAuthSession): AuthEvent {
  return {
    type: "AuthSessionIssued",
    aggregateType: "AuthSession",
    aggregateId: session.id,
    occurredAt: session.issuedAt,
    payload: {
      sessionId: session.id,
      credentialId: session.credentialId,
      customerId: session.customerId,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
    },
  };
}

export function revokeAuthSession(
  session: AuthSession,
  now: Date,
): Result<AuthSessionTransition<RevokedAuthSession>, RevokeAuthSessionError> {
  switch (session.status) {
    case "ACTIVE": {
      const revoked: RevokedAuthSession = {
        ...session,
        status: "REVOKED",
        revokedAt: now,
        updatedAt: now,
      };
      return ok({
        session: revoked,
        events: [
          {
            type: "AuthSessionRevoked",
            aggregateType: "AuthSession",
            aggregateId: revoked.id,
            occurredAt: now,
            payload: {
              sessionId: revoked.id,
              credentialId: revoked.credentialId,
              customerId: revoked.customerId,
              revokedAt: revoked.revokedAt,
            },
          },
        ],
      });
    }

    case "REVOKED":
      return ok({ session, events: [] });

    case "EXPIRED":
      return err(notUsableSession(session.status));
  }
}

export function expireAuthSession(
  session: AuthSession,
  now: Date,
): Result<AuthSessionTransition<ExpiredAuthSession>, ExpireAuthSessionError> {
  switch (session.status) {
    case "ACTIVE": {
      const expired: ExpiredAuthSession = {
        ...session,
        status: "EXPIRED",
        expiredAt: now,
        updatedAt: now,
      };
      return ok({
        session: expired,
        events: [
          {
            type: "AuthSessionExpired",
            aggregateType: "AuthSession",
            aggregateId: expired.id,
            occurredAt: now,
            payload: {
              sessionId: expired.id,
              credentialId: expired.credentialId,
              customerId: expired.customerId,
              expiredAt: expired.expiredAt,
            },
          },
        ],
      });
    }

    case "EXPIRED":
      return ok({ session, events: [] });

    case "REVOKED":
      return err(notUsableSession(session.status));
  }
}

export function validatePlainPassword(password: string): InvalidAuthInput | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      type: "InvalidAuthInput",
      field: "password",
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  return null;
}

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSessionCurrentlyActive(session: AuthSession, now: Date): boolean {
  return session.status === "ACTIVE" && session.expiresAt.getTime() > now.getTime();
}

function validateRequiredFields(
  entries: readonly (readonly [InvalidAuthInput["field"], string])[],
): InvalidAuthInput | null {
  for (const [field, value] of entries) {
    if (value.trim().length === 0) {
      return {
        type: "InvalidAuthInput",
        field,
        message: `Auth ${field} is required`,
      };
    }
  }

  return null;
}

function validateEmail(email: string): InvalidAuthInput | null {
  if (!email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
    return {
      type: "InvalidAuthInput",
      field: "email",
      message: "Auth email is invalid",
    };
  }

  return null;
}

function notUsableCredential(status: EmailCredential["status"]): AuthCredentialNotUsable {
  return {
    type: "AuthCredentialNotUsable",
    status,
    message: "Auth credential cannot be used in its current status",
  };
}

function notUsableSession(status: AuthSession["status"]): AuthSessionNotUsable {
  return {
    type: "AuthSessionNotUsable",
    status,
    message: "Auth session cannot be used in its current status",
  };
}
