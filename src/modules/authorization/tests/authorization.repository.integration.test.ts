import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import {
  authorizationRoleGrantedEvent,
  grantAuthorizationRole,
  revokeAuthorizationRole,
} from "../domain/index.js";
import {
  createKyselyAuthorizationOutboxRepository,
  createKyselyAuthorizationRepository,
} from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createGrantFixture() {
  const granted = grantAuthorizationRole({
    id: "grant-1",
    actorId: "actor-1",
    role: "SUPPORT_AGENT",
    idempotencyKey: "grant-role-1",
    grantedByActorId: "admin-1",
    grantReason: "support team member",
    now,
  });
  if (!granted.ok) {
    throw new Error("expected authorization role grant to be created");
  }
  return granted.value;
}

describe.runIf(dockerAvailable)("authorization repository integration", () => {
  it("persists role grant projection, domain events, and outbox rows", async () => {
    await withTestDatabase(async (db) => {
      const grants = createKyselyAuthorizationRepository(db);
      const outbox = createKyselyAuthorizationOutboxRepository(db);
      const grant = createGrantFixture();
      const grantedEvents = [authorizationRoleGrantedEvent(grant)];
      await grants.create(grant, grantedEvents);
      await outbox.saveAll(grantedEvents);

      const current = await grants.findById("grant-1");
      if (current === null) {
        throw new Error("expected authorization role grant to be loaded");
      }
      const revoked = revokeAuthorizationRole(current, {
        revokedByActorId: "admin-1",
        revokeReason: "team changed",
        now: later,
      });
      if (!revoked.ok) {
        throw new Error("expected authorization role grant to be revoked");
      }
      await grants.save(revoked.value.grant, revoked.value.events);
      await outbox.saveAll(revoked.value.events);

      const saved = await grants.findById("grant-1");
      const active = await grants.findActiveByActorId("actor-1");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "AuthorizationRoleGrant")
        .orderBy("created_at", "asc")
        .execute();
      const outboxRows = await db
        .selectFrom("outbox_events")
        .selectAll()
        .where("aggregate_type", "=", "AuthorizationRoleGrant")
        .orderBy("created_at", "asc")
        .execute();

      expect(saved?.status).toBe("REVOKED");
      expect(active).toHaveLength(0);
      expect(domainEventRows.map((row) => row.event_type)).toEqual([
        "AuthorizationRoleGranted",
        "AuthorizationRoleRevoked",
      ]);
      expect(outboxRows.map((row) => row.event_type)).toEqual([
        "AuthorizationRoleGranted",
        "AuthorizationRoleRevoked",
      ]);
    });
  });
});

describe.runIf(!dockerAvailable)("authorization repository integration prerequisites", () => {
  it("documents that Docker is required for authorization repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
