import type { Result } from "../../../shared/result/index.js";
import type {
  DisableEmailCredentialUseCaseError,
  DisableEmailCredentialUseCaseResult,
  LoginWithEmailUseCaseError,
  LoginWithEmailUseCaseResult,
  RegisterEmailCredentialUseCaseError,
  RegisterEmailCredentialUseCaseResult,
  RevokeAuthSessionUseCaseError,
  RevokeAuthSessionUseCaseResult,
  VerifyAuthSessionUseCaseResult,
} from "../application/index.js";
import type { AuthSession, EmailCredential } from "../domain/index.js";

export type AuthHttpResponseShape = Readonly<{
  status: 200 | 201 | 400 | 401 | 404 | 409;
  body: unknown;
}>;

export function serializeEmailCredential(credential: EmailCredential): Record<string, unknown> {
  return {
    id: credential.id,
    customerId: credential.customerId,
    idempotencyKey: credential.idempotencyKey,
    email: credential.email,
    status: credential.status,
    failedLoginCount: credential.failedLoginCount,
    registeredAt: credential.registeredAt.toISOString(),
    passwordUpdatedAt: credential.passwordUpdatedAt.toISOString(),
    lastLoginAt: credential.lastLoginAt?.toISOString() ?? null,
    lockedAt: credential.lockedAt?.toISOString() ?? null,
    disabledAt: credential.disabledAt?.toISOString() ?? null,
    version: credential.version,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  };
}

export function serializeAuthSession(session: AuthSession): Record<string, unknown> {
  return {
    id: session.id,
    customerId: session.customerId,
    credentialId: session.credentialId,
    status: session.status,
    issuedAt: session.issuedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString() ?? null,
    expiredAt: session.expiredAt?.toISOString() ?? null,
    version: session.version,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export function mapRegisterEmailCredentialResult(
  result: Result<RegisterEmailCredentialUseCaseResult, RegisterEmailCredentialUseCaseError>,
): AuthHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializeEmailCredential(result.value.credential),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapAuthError(result.error);
}

export function mapLoginWithEmailResult(
  result: Result<LoginWithEmailUseCaseResult, LoginWithEmailUseCaseError>,
): AuthHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: {
          credential: serializeEmailCredential(result.value.credential),
          session: serializeAuthSession(result.value.session),
          token: result.value.token,
        },
      },
    };
  }

  return mapAuthError(result.error);
}

export function mapVerifyAuthSessionResult(
  result: Result<VerifyAuthSessionUseCaseResult, never>,
): AuthHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: {
          active: result.value.active,
          session:
            result.value.session === null ? null : serializeAuthSession(result.value.session),
        },
      },
    };
  }

  throw new Error("Unexpected auth session verification failure");
}

export function mapRevokeAuthSessionResult(
  result: Result<RevokeAuthSessionUseCaseResult, RevokeAuthSessionUseCaseError>,
): AuthHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeAuthSession(result.value.session),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapAuthError(result.error);
}

export function mapDisableEmailCredentialResult(
  result: Result<DisableEmailCredentialUseCaseResult, DisableEmailCredentialUseCaseError>,
): AuthHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeEmailCredential(result.value.credential),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapAuthError(result.error);
}

function mapAuthError(
  error:
    | RegisterEmailCredentialUseCaseError
    | LoginWithEmailUseCaseError
    | RevokeAuthSessionUseCaseError
    | DisableEmailCredentialUseCaseError,
): AuthHttpResponseShape {
  switch (error.type) {
    case "InvalidAuthInput":
      return { status: 400, body: { error } };

    case "InvalidAuthCredentials":
      return { status: 401, body: { error } };

    case "AuthCredentialNotFound":
    case "AuthSessionNotFound":
      return { status: 404, body: { error } };

    case "AuthCredentialIdempotencyConflict":
    case "AuthEmailAlreadyRegistered":
    case "AuthCredentialNotUsable":
    case "AuthSessionNotUsable":
      return { status: 409, body: { error } };
  }
}
