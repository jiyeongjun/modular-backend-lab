import { describe, expect, it } from "vitest";
import {
  createLoginWithEmailUseCase,
  createRegisterEmailCredentialUseCase,
  createRevokeAuthSessionUseCase,
  createVerifyAuthSessionUseCase,
} from "../application/index.js";
import type { AuthEvent, AuthSession, EmailCredential } from "../domain/index.js";
import type {
  AuthCredentialRepository,
  AuthOutboxRepository,
  AuthSessionRepository,
  AuthTokenService,
  AuthUnitOfWork,
  PasswordHasher,
} from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createFakeUow(): {
  uow: AuthUnitOfWork;
  credentials: EmailCredential[];
  sessions: AuthSession[];
  outboxEvents: AuthEvent[];
} {
  const credentialState: EmailCredential[] = [];
  const sessionState: AuthSession[] = [];
  const outboxEvents: AuthEvent[] = [];

  function findCredentialBy(
    predicate: (credential: EmailCredential) => boolean,
  ): EmailCredential | null {
    return credentialState.find(predicate) ?? null;
  }

  function findSessionBy(predicate: (session: AuthSession) => boolean): AuthSession | null {
    return sessionState.find(predicate) ?? null;
  }

  const credentials: AuthCredentialRepository = {
    findById: async (id) => findCredentialBy((credential) => credential.id === id),
    findByIdForUpdate: async (id) => findCredentialBy((credential) => credential.id === id),
    findByEmail: async (email) => findCredentialBy((credential) => credential.email === email),
    findByEmailForUpdate: async (email) =>
      findCredentialBy((credential) => credential.email === email),
    findByIdempotencyKey: async (idempotencyKey) =>
      findCredentialBy((credential) => credential.idempotencyKey === idempotencyKey),
    create: async (credential) => {
      credentialState.push(credential);
    },
    save: async (credential) => {
      const index = credentialState.findIndex((current) => current.id === credential.id);
      if (index === -1) {
        throw new Error("credential missing");
      }
      credentialState[index] = credential;
    },
  };

  const sessions: AuthSessionRepository = {
    findById: async (id) => findSessionBy((session) => session.id === id),
    findByIdForUpdate: async (id) => findSessionBy((session) => session.id === id),
    findByTokenHash: async (tokenHash) =>
      findSessionBy((session) => session.tokenHash === tokenHash),
    findByTokenHashForUpdate: async (tokenHash) =>
      findSessionBy((session) => session.tokenHash === tokenHash),
    create: async (session) => {
      sessionState.push(session);
    },
    save: async (session) => {
      const index = sessionState.findIndex((current) => current.id === session.id);
      if (index === -1) {
        throw new Error("session missing");
      }
      sessionState[index] = session;
    },
  };

  const outbox: AuthOutboxRepository = {
    saveAll: async (events) => {
      outboxEvents.push(...events);
    },
  };

  return {
    uow: {
      async withTransaction(work) {
        return work({ credentials, sessions, outbox });
      },
    },
    credentials: credentialState,
    sessions: sessionState,
    outboxEvents,
  };
}

const passwordHasher: PasswordHasher = {
  hash: async (plainPassword) => `hashed:${plainPassword}`,
  verify: async (plainPassword, passwordHash) => passwordHash === `hashed:${plainPassword}`,
};

const tokenService: AuthTokenService = {
  issue: async () => ({ token: "session-token", tokenHash: "hashed-token" }),
  hash: async (token) => `hashed-${token}`,
};

async function registerCredentialFixture(fake: ReturnType<typeof createFakeUow>): Promise<void> {
  const register = createRegisterEmailCredentialUseCase({
    uow: fake.uow,
    passwordHasher,
    now: () => now,
    generateId: () => "credential-1",
  });
  const result = await register({
    customerId: "customer-1",
    idempotencyKey: "auth-register-1",
    email: "customer@example.com",
    password: "password-1",
  });
  if (!result.ok) {
    throw new Error("expected credential fixture to be registered");
  }
}

describe("auth usecases", () => {
  it("registers email credentials idempotently", async () => {
    const fake = createFakeUow();
    const register = createRegisterEmailCredentialUseCase({
      uow: fake.uow,
      passwordHasher,
      now: () => now,
      generateId: () => "credential-1",
    });

    const first = await register({
      customerId: "customer-1",
      idempotencyKey: "auth-register-1",
      email: "CUSTOMER@EXAMPLE.COM",
      password: "password-1",
    });
    const second = await register({
      customerId: "customer-1",
      idempotencyKey: "auth-register-1",
      email: "customer@example.com",
      password: "password-1",
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("expected registration to succeed");
    }
    expect(first.value.idempotent).toBe(false);
    expect(second.value.idempotent).toBe(true);
    expect(fake.credentials).toHaveLength(1);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual(["EmailCredentialRegistered"]);
  });

  it("logs in with a valid password and creates a session", async () => {
    const fake = createFakeUow();
    await registerCredentialFixture(fake);
    const login = createLoginWithEmailUseCase({
      uow: fake.uow,
      passwordHasher,
      tokenService,
      now: () => later,
      generateSessionId: () => "session-1",
      sessionTtlMs: 60_000,
    });

    const result = await login({
      email: "customer@example.com",
      password: "password-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected login to succeed");
    }
    expect(result.value.token).toBe("session-token");
    expect(fake.sessions).toHaveLength(1);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual([
      "EmailCredentialRegistered",
      "EmailCredentialLoginSucceeded",
      "AuthSessionIssued",
    ]);
  });

  it("records failed logins when the password is invalid", async () => {
    const fake = createFakeUow();
    await registerCredentialFixture(fake);
    const login = createLoginWithEmailUseCase({
      uow: fake.uow,
      passwordHasher,
      tokenService,
      now: () => later,
      generateSessionId: () => "session-1",
      sessionTtlMs: 60_000,
    });

    const result = await login({
      email: "customer@example.com",
      password: "wrong-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected login to fail");
    }
    expect(result.error.type).toBe("InvalidAuthCredentials");
    expect(fake.credentials[0]?.failedLoginCount).toBe(1);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual([
      "EmailCredentialRegistered",
      "EmailCredentialLoginFailed",
    ]);
  });

  it("verifies and revokes sessions by token hash", async () => {
    const fake = createFakeUow();
    await registerCredentialFixture(fake);
    const login = createLoginWithEmailUseCase({
      uow: fake.uow,
      passwordHasher,
      tokenService,
      now: () => now,
      generateSessionId: () => "session-1",
      sessionTtlMs: 24 * 60 * 60 * 1000,
    });
    const verify = createVerifyAuthSessionUseCase({
      uow: fake.uow,
      tokenService: { issue: tokenService.issue, hash: async () => "hashed-token" },
      now: () => later,
    });
    const revoke = createRevokeAuthSessionUseCase({
      uow: fake.uow,
      tokenService: { issue: tokenService.issue, hash: async () => "hashed-token" },
      now: () => later,
    });

    await login({ email: "customer@example.com", password: "password-1" });
    const verified = await verify({ token: "session-token" });
    const revoked = await revoke({ token: "session-token" });

    expect(verified.ok).toBe(true);
    expect(revoked.ok).toBe(true);
    if (!verified.ok || !revoked.ok) {
      throw new Error("expected session operations to succeed");
    }
    expect(verified.value.active).toBe(true);
    expect(revoked.value.session.status).toBe("REVOKED");
  });
});
