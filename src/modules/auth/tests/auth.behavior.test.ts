import { describe, expect, it } from "vitest";
import {
  authSessionIssuedEvent,
  createAuthSession,
  createEmailCredential,
  type EmailCredential,
  expireAuthSession,
  recordLoginFailed,
  recordLoginSucceeded,
  revokeAuthSession,
} from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");
const expiresAt = new Date("2026-01-02T00:00:00.000Z");

function createCredentialFixture() {
  const credential = createEmailCredential({
    id: "credential-1",
    customerId: "customer-1",
    idempotencyKey: "auth-register-1",
    email: "CUSTOMER@EXAMPLE.COM",
    passwordHash: "hashed-password",
    now,
  });
  if (!credential.ok) {
    throw new Error("expected credential to be created");
  }
  return credential.value;
}

function createSessionFixture() {
  const session = createAuthSession({
    id: "session-1",
    customerId: "customer-1",
    credentialId: "credential-1",
    tokenHash: "token-hash",
    issuedAt: now,
    expiresAt,
  });
  if (!session.ok) {
    throw new Error("expected session to be created");
  }
  return session.value;
}

describe("auth domain behavior", () => {
  it("registers active email credentials with normalized email", () => {
    const credential = createCredentialFixture();

    expect(credential.status).toBe("ACTIVE");
    expect(credential.email).toBe("customer@example.com");
  });

  it("locks credentials after repeated failed logins", () => {
    let credential: EmailCredential = createCredentialFixture();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const failed = recordLoginFailed(credential, {
        maxFailedAttempts: 5,
        now: later,
      });
      if (!failed.ok) {
        throw new Error("expected failed login to be recorded");
      }
      credential = failed.value.credential;
    }

    expect(credential.status).toBe("LOCKED");
    expect(credential.failedLoginCount).toBe(5);
  });

  it("resets failed login count when login succeeds", () => {
    const failed = recordLoginFailed(createCredentialFixture(), {
      maxFailedAttempts: 5,
      now,
    });
    if (!failed.ok) {
      throw new Error("expected failed login to be recorded");
    }

    const succeeded = recordLoginSucceeded(failed.value.credential, later);

    expect(succeeded.ok).toBe(true);
    if (!succeeded.ok) {
      throw new Error("expected login success to be recorded");
    }
    expect(succeeded.value.credential.failedLoginCount).toBe(0);
    expect(succeeded.value.events.map((event) => event.type)).toEqual([
      "EmailCredentialLoginSucceeded",
    ]);
  });

  it("issues, revokes, and expires sessions through explicit transitions", () => {
    const session = createSessionFixture();
    const issuedEvent = authSessionIssuedEvent(session);
    const revoked = revokeAuthSession(session, later);
    const expired = expireAuthSession(createSessionFixture(), later);

    expect(issuedEvent.type).toBe("AuthSessionIssued");
    expect(revoked.ok).toBe(true);
    expect(expired.ok).toBe(true);
    if (!revoked.ok || !expired.ok) {
      throw new Error("expected session transitions to succeed");
    }
    expect(revoked.value.session.status).toBe("REVOKED");
    expect(expired.value.session.status).toBe("EXPIRED");
  });
});
