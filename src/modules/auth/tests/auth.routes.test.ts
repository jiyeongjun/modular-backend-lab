import { describe, expect, it } from "vitest";
import { createRouteTestApp } from "../../../../test/http/create-test-app.js";
import { err, ok } from "../../../shared/result/index.js";
import type {
  DisableEmailCredentialUseCase,
  LoginWithEmailUseCase,
  RegisterEmailCredentialUseCase,
  RevokeAuthSessionUseCase,
  VerifyAuthSessionUseCase,
} from "../application/index.js";
import type { ActiveAuthSession, ActiveEmailCredential } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const expiresAt = new Date("2026-01-02T00:00:00.000Z");

function createCredential(): ActiveEmailCredential {
  return {
    id: "credential-1",
    customerId: "customer-1",
    idempotencyKey: "auth-register-1",
    email: "customer@example.com",
    passwordHash: "hashed-password",
    status: "ACTIVE",
    failedLoginCount: 0,
    registeredAt: now,
    passwordUpdatedAt: now,
    lastLoginAt: null,
    lockedAt: null,
    disabledAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function createSession(): ActiveAuthSession {
  return {
    id: "session-1",
    customerId: "customer-1",
    credentialId: "credential-1",
    tokenHash: "hashed-token",
    status: "ACTIVE",
    issuedAt: now,
    expiresAt,
    revokedAt: null,
    expiredAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function createTestApp(overrides: {
  registerEmailCredentialUseCase?: RegisterEmailCredentialUseCase;
  loginWithEmailUseCase?: LoginWithEmailUseCase;
  verifyAuthSessionUseCase?: VerifyAuthSessionUseCase;
  revokeAuthSessionUseCase?: RevokeAuthSessionUseCase;
  disableEmailCredentialUseCase?: DisableEmailCredentialUseCase;
}) {
  return createRouteTestApp({
    registerEmailCredentialUseCase:
      overrides.registerEmailCredentialUseCase ??
      (async () => ok({ credential: createCredential(), idempotent: false })),
    loginWithEmailUseCase:
      overrides.loginWithEmailUseCase ??
      (async () =>
        ok({
          credential: createCredential(),
          session: createSession(),
          token: "session-token",
        })),
    verifyAuthSessionUseCase:
      overrides.verifyAuthSessionUseCase ??
      (async () => ok({ active: true, session: createSession() })),
    revokeAuthSessionUseCase:
      overrides.revokeAuthSessionUseCase ??
      (async () => ok({ session: createSession(), idempotent: false })),
    disableEmailCredentialUseCase:
      overrides.disableEmailCredentialUseCase ??
      (async () => ok({ credential: createCredential(), idempotent: false })),
  });
}

describe("auth routes", () => {
  it("returns 201 when email credential is registered", async () => {
    const app = createTestApp({});

    const response = await app.request("/auth/email/register", {
      method: "POST",
      body: JSON.stringify({
        customerId: "customer-1",
        idempotencyKey: "auth-register-1",
        email: "customer@example.com",
        password: "password-1",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid email login body", async () => {
    const app = createTestApp({});

    const response = await app.request("/auth/email/login", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", password: "password-1" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("maps invalid credentials to 401", async () => {
    const app = createTestApp({
      loginWithEmailUseCase: async () =>
        err({ type: "InvalidAuthCredentials", message: "Email or password is invalid" }),
    });

    const response = await app.request("/auth/email/login", {
      method: "POST",
      body: JSON.stringify({ email: "customer@example.com", password: "password-1" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(401);
  });

  it("returns 200 when session is verified", async () => {
    const app = createTestApp({});

    const response = await app.request("/auth/sessions/verify", {
      method: "POST",
      body: JSON.stringify({ token: "session-token" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
  });

  it("returns 200 when session is revoked", async () => {
    const app = createTestApp({});

    const response = await app.request("/auth/sessions/revoke", {
      method: "POST",
      body: JSON.stringify({ token: "session-token" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
  });

  it("maps missing credential disable to 404", async () => {
    const app = createTestApp({
      disableEmailCredentialUseCase: async () =>
        err({
          type: "AuthCredentialNotFound",
          credentialId: "missing-credential",
          message: "Auth credential was not found",
        }),
    });

    const response = await app.request("/auth/credentials/missing-credential/disable", {
      method: "POST",
    });

    expect(response.status).toBe(404);
  });
});
