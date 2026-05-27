import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import {
  authSessionIssuedEvent,
  createAuthSession,
  createEmailCredential,
  emailCredentialRegisteredEvent,
  recordLoginSucceeded,
} from "../domain/index.js";
import {
  createKyselyAuthCredentialRepository,
  createKyselyAuthOutboxRepository,
  createKyselyAuthSessionRepository,
} from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");
const expiresAt = new Date("2026-01-02T00:00:00.000Z");

function createCredentialFixture() {
  const credential = createEmailCredential({
    id: "credential-1",
    customerId: "customer-1",
    idempotencyKey: "auth-register-1",
    email: "customer@example.com",
    passwordHash: "hashed-password",
    now,
  });
  if (!credential.ok) {
    throw new Error("expected credential to be created");
  }
  return credential.value;
}

describe.runIf(dockerAvailable)("auth repository integration", () => {
  it("persists auth projections, domain events, and outbox rows", async () => {
    await withTestDatabase(async (db) => {
      const credentials = createKyselyAuthCredentialRepository(db);
      const sessions = createKyselyAuthSessionRepository(db);
      const outbox = createKyselyAuthOutboxRepository(db);
      const credential = createCredentialFixture();
      const registeredEvents = [emailCredentialRegisteredEvent(credential)];
      await credentials.create(credential, registeredEvents);
      await outbox.saveAll(registeredEvents);

      const loaded = await credentials.findByEmailForUpdate("customer@example.com");
      if (loaded === null) {
        throw new Error("expected credential to be loaded");
      }
      const login = recordLoginSucceeded(loaded, later);
      if (!login.ok) {
        throw new Error("expected login success to be recorded");
      }
      const session = createAuthSession({
        id: "session-1",
        customerId: "customer-1",
        credentialId: "credential-1",
        tokenHash: "hashed-token",
        issuedAt: later,
        expiresAt,
      });
      if (!session.ok) {
        throw new Error("expected session to be created");
      }
      const sessionEvents = [authSessionIssuedEvent(session.value)];
      await credentials.save(login.value.credential, login.value.events);
      await sessions.create(session.value, sessionEvents);
      await outbox.saveAll([...login.value.events, ...sessionEvents]);

      const savedCredential = await credentials.findById("credential-1");
      const savedSession = await sessions.findByTokenHash("hashed-token");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_id", "in", ["credential-1", "session-1"])
        .orderBy("created_at", "asc")
        .execute();
      const outboxRows = await db
        .selectFrom("outbox_events")
        .selectAll()
        .where("aggregate_id", "in", ["credential-1", "session-1"])
        .orderBy("created_at", "asc")
        .execute();

      expect(savedCredential?.lastLoginAt?.toISOString()).toBe(later.toISOString());
      expect(savedSession?.status).toBe("ACTIVE");
      expect(domainEventRows.map((row) => row.event_type)).toEqual([
        "EmailCredentialRegistered",
        "EmailCredentialLoginSucceeded",
        "AuthSessionIssued",
      ]);
      expect(outboxRows.map((row) => row.event_type)).toEqual([
        "EmailCredentialRegistered",
        "EmailCredentialLoginSucceeded",
        "AuthSessionIssued",
      ]);
    });
  });
});

describe.runIf(!dockerAvailable)("auth repository integration prerequisites", () => {
  it("documents that Docker is required for auth repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
